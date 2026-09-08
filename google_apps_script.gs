/**
 * =========================================================================
 * KOMPETENZEN MULTI-SHEET ROUTER & AUTOMATION WITH GOOGLE DRIVE RESUME UPLOAD
 * =========================================================================
 * 
 * Automatically routes and organizes data into separate dedicated tabs:
 * 1. "Course_Enrollments" -> Dedicated Tab for Course Enrollments & Inquiries (with Enrolled Course name)
 * 2. "Job_Applications"   -> Full Candidate Profiles & Job Applications + Resume PDF Link
 * 3. "Job_Openings"       -> Jobs posted by Admin
 * =========================================================================
 */

/**
 * ONE-TIME AUTHORIZATION FUNCTION:
 * Run this function once from the Apps Script editor toolbar to authorize Drive permissions.
 */
function authorizeDrivePermissions() {
  var folderName = 'Kompetenzen_Candidate_Resumes';
  var folders = DriveApp.getFoldersByName(folderName);
  var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  Logger.log('Drive permission granted! Folder ready: ' + folder.getName());
  setupResumeColumn();
}

function doPost(e) {
  return handleRequest(e);
}

function doGet(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(15000);

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var params = {};

    // 1. Extract params from form data, query params, or JSON body
    if (e && e.parameter) {
      for (var key in e.parameter) {
        params[key] = e.parameter[key];
      }
    }
    if (e && e.postData && e.postData.contents) {
      try {
        var jsonBody = JSON.parse(e.postData.contents);
        for (var k in jsonBody) {
          params[k] = jsonBody[k];
        }
      } catch (err) {
        // Not JSON, already extracted in e.parameter
      }
    }

    var type = (params.type || '').toLowerCase();
    var timestamp = params.timestamp || Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm:ss');

    // =========================================================================
    // ROUTE 0: User Verification & Authentication Query (Cross-Sheet Auth)
    // Allows Course Details login to verify credentials against Users_Auth
    // =========================================================================
    if (type === 'verify_user' || type === 'check_auth' || type === 'get_user') {
      var emailToCheck = String(params.email || '').trim().toLowerCase();
      var passToCheck = String(params.password || '');
      
      var foundUser = findUserInAuthSheets(ss, emailToCheck, passToCheck);
      if (foundUser) {
        return createJsonResponse({
          status: 'success',
          verified: true,
          user: foundUser,
          message: 'User successfully verified against ' + foundUser.sourceSheet
        });
      } else {
        return createJsonResponse({
          status: 'not_found',
          verified: false,
          message: 'User credentials not found in Users_Auth or Course_Login_Details'
        });
      }
    }

    // =========================================================================
    // ROUTE 1: User Login & Signup Events (Course_Login_Details vs Users_Auth)
    // Course Details -> "Course_Login_Details"
    // Job Listing & Resume Builder -> "Users_Auth"
    // =========================================================================
    else if (type === 'auth' || type === 'signup' || type === 'login' || type === 'google_auth') {
      var authHeaders = [
        'Timestamp',
        'Full Name',
        'Email Address',
        'Phone Number',
        'Password',
        'Auth Type',
        'Action',
        'Section',
        'Page URL'
      ];

      // Determine target sheet tab
      var sectionParam = (params.section || '').toLowerCase();
      var pageParam = (params.page || '').toLowerCase();
      var explicitTarget = params.targetSheet || params.sheet || '';

      var targetSheetName = 'Users_Auth';
      var headerColor = '#1d4ed8'; // Royal blue for Users_Auth

      if (explicitTarget) {
        targetSheetName = explicitTarget;
        if (targetSheetName === 'Course_Login_Details') headerColor = '#4f46e5';
      } else if (
        sectionParam.indexOf('course') > -1 ||
        pageParam.indexOf('school') > -1 ||
        pageParam.indexOf('course') > -1 ||
        (pageParam.indexOf('index.html') > -1 && sectionParam.indexOf('job') === -1 && sectionParam.indexOf('resume') === -1)
      ) {
        targetSheetName = 'Course_Login_Details';
        headerColor = '#4f46e5'; // Indigo for Course_Login_Details
      }

      var authSheet = getOrCreateSheet(ss, targetSheetName, authHeaders, headerColor);

      // Deduplication: prevent rapid duplicate submissions
      var lastRow = authSheet.getLastRow();
      if (lastRow > 1) {
        var lastVals = authSheet.getRange(lastRow, 1, 1, 6).getValues()[0];
        var lastTs = String(lastVals[0] || '').trim();
        var lastNm = String(lastVals[1] || '').trim().toLowerCase();
        var lastEm = String(lastVals[2] || '').trim().toLowerCase();
        var lastPh = String(lastVals[3] || '').trim();
        var lastType = String(lastVals[5] || '').trim().toLowerCase();

        var thisNm = String(params.name || '').trim().toLowerCase();
        var thisEm = String(params.email || '').trim().toLowerCase();
        var thisPh = String(params.phone || '').trim();
        var thisType = String(params.authType || params.type || '').trim().toLowerCase();

        if (lastTs === String(timestamp).trim() || (thisEm && lastEm === thisEm && lastType === thisType && (lastPh === thisPh || lastNm === thisNm))) {
          return createJsonResponse({
            status: 'success',
            sheet: targetSheetName,
            message: 'Duplicate ignored — single row preserved'
          });
        }
      }

      var authTypeVal = params.authType || (type === 'login' ? 'Email Login' : (type === 'google_auth' ? 'Google Auth' : 'Email Signup'));
      var actionVal = params.action || (type === 'login' ? 'User Logged In' : (type === 'google_auth' ? 'Google Sign In' : 'Account Created'));
      var sectionVal = params.section || (targetSheetName === 'Course_Login_Details' ? 'Course Details' : 'Job Listing');

      authSheet.appendRow([
        timestamp,
        params.name || '',
        params.email || '',
        params.phone || '',
        params.password || '',
        authTypeVal,
        actionVal,
        sectionVal,
        params.page || ''
      ]);

      return createJsonResponse({
        status: 'success',
        sheet: targetSheetName,
        message: 'Login/Signup details recorded successfully in ' + targetSheetName
      });
    }

    // =========================================================================
    // ROUTE 2: Job Applications & Full Candidate Profile Data
    // =========================================================================
    else if (type === 'job_application' || type === 'jobs' || type === 'apply' || type === 'profile') {
      var appHeaders = [
        'Timestamp',
        'Full Name',
        'WhatsApp Number',
        'Email Address',
        'Degree & Branch',
        'Graduation Year',
        'Kompetenzen Student?',
        'Course Name',
        'Experience Level',
        'Preferred Locations',
        'Work Mode',
        'Key Skills',
        'Applied Job Role',
        'Target Company',
        'Page URL',
        'Resume PDF (Click to Open)'
      ];

      var appSheet = getOrCreateSheet(ss, 'Job_Applications', appHeaders, '#047857'); // Emerald green header

      // Server-side Deduplication: Prevent duplicate rows if client fires twice or user double-clicks
      var lastRow = appSheet.getLastRow();
      if (lastRow > 1) {
        var lastVals = appSheet.getRange(lastRow, 1, 1, 5).getValues()[0];
        var lastTs = String(lastVals[0] || '').trim();
        var lastNm = String(lastVals[1] || '').trim().toLowerCase();
        var lastPh = String(lastVals[2] || '').trim();
        var lastEm = String(lastVals[3] || '').trim().toLowerCase();

        var thisNm = String(params.name || '').trim().toLowerCase();
        var thisPh = String(params.phone || '').trim();
        var thisEm = String(params.email || '').trim().toLowerCase();

        // If duplicate submission with identical timestamp or same person submitting back-to-back
        if (lastTs === String(timestamp).trim() || (thisEm && lastEm === thisEm && (lastPh === thisPh || lastNm === thisNm))) {
          return createJsonResponse({
            status: 'success',
            sheet: 'Job_Applications',
            message: 'Duplicate ignored — single row preserved'
          });
        }
      }

      // Save Resume to Google Drive if provided
      var resumeLink = '';
      if (params.resumeData && String(params.resumeData).length > 50) {
        try {
          var folderName = 'Kompetenzen_Candidate_Resumes';
          var folders = DriveApp.getFoldersByName(folderName);
          var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

          var rawData = String(params.resumeData);
          if (rawData.indexOf('base64,') > -1) {
            rawData = rawData.split('base64,')[1];
          }

          var decoded = Utilities.base64Decode(rawData);
          var candidateName = (params.name || 'Candidate').replace(/[^a-zA-Z0-9]/g, '_');
          var originalName = params.resumeFileName || 'Resume.pdf';
          var ext = originalName.indexOf('.') > -1 ? '.' + originalName.split('.').pop() : '.pdf';
          var fileName = candidateName + '_Resume' + ext;
          var mimeType = params.resumeMimeType || 'application/pdf';

          var blob = Utilities.newBlob(decoded, mimeType, fileName);
          var driveFile = folder.createFile(blob);
          try {
            driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          } catch (shareErr) {
            // Sharing policy fallback
          }
          resumeLink = driveFile.getUrl();
        } catch (fErr) {
          resumeLink = 'Error: ' + fErr.toString();
        }
      } else if (params.resumeName && params.resumeName !== 'Not uploaded') {
        resumeLink = params.resumeName;
      }

      var resumeCell = (resumeLink.indexOf('http') === 0)
        ? '=HYPERLINK("' + resumeLink + '", "📄 View Resume PDF")'
        : (resumeLink || 'Not Uploaded');

      appSheet.appendRow([
        timestamp,
        params.name || '',
        params.phone || '',
        params.email || '',
        params.degree || '',
        params.gradYear || params.graduationYear || '',
        params.isStudent || params.isKompetenzenStudent || 'No',
        params.courseName || '',
        params.experience || '',
        params.preferredLocation || params.preferredLocations || '',
        params.workMode || '',
        params.skills || '',
        params.jobRole || params.role || '',
        params.company || '',
        params.page || '',
        resumeCell
      ]);

      return createJsonResponse({
        status: 'success',
        sheet: 'Job_Applications',
        resumeUrl: resumeLink,
        message: 'Job application & resume recorded successfully'
      });
    }

    // =========================================================================
    // ROUTE 3: Delete Application Row from Google Sheet (Triggered by Admin Delete)
    // =========================================================================
    else if (type === 'delete_application' || type === 'delete') {
      var appSheet = ss.getSheetByName('Job_Applications');
      if (!appSheet) {
        return createJsonResponse({ status: 'error', message: 'Job_Applications tab not found' });
      }

      var targetEmail = String(params.email || '').trim().toLowerCase();
      var targetPhone = String(params.phone || '').trim();
      var targetName = String(params.name || '').trim().toLowerCase();
      var targetTs = String(params.timestamp || '').trim();
      var deletedRows = 0;

      var lastRow = appSheet.getLastRow();
      if (lastRow > 1) {
        var data = appSheet.getRange(1, 1, lastRow, 5).getValues();
        // Iterate backward so row deletion does not disturb remaining row indices
        for (var i = data.length - 1; i >= 1; i--) {
          var rowTs = String(data[i][0] || '').trim();
          var rowName = String(data[i][1] || '').trim().toLowerCase();
          var rowPhone = String(data[i][2] || '').trim();
          var rowEmail = String(data[i][3] || '').trim().toLowerCase();

          var isMatch = false;
          if (targetTs && rowTs && targetTs === rowTs) {
            isMatch = true;
          } else if (targetEmail && rowEmail && targetEmail === rowEmail) {
            isMatch = true;
          } else if (targetName && targetPhone && targetName === rowName && targetPhone === rowPhone) {
            isMatch = true;
          }

          if (isMatch) {
            appSheet.deleteRow(i + 1);
            deletedRows++;
          }
        }
      }

      return createJsonResponse({
        status: 'success',
        deletedRows: deletedRows,
        message: 'Deleted ' + deletedRows + ' application row(s) from Job_Applications'
      });
    }

    // =========================================================================
    // ROUTE 4: Job Openings Posted by Admin
    // =========================================================================
    else if (type === 'job_posting' || type === 'create_job' || type === 'post_job' || type === 'hr_job') {
      var jobHeaders = [
        'Timestamp',
        'Job ID',
        'Job Title',
        'Company Name',
        'Category',
        'Job Type',
        'Location',
        'Experience Required',
        'Salary Range',
        'Key Skills',
        'Description',
        'Application URL / Portal Link',
        'Direct Company Portal?'
      ];

      var jobSheet = getOrCreateSheet(ss, 'Job_Openings', jobHeaders, '#1d4ed8'); // Royal blue header

      jobSheet.appendRow([
        timestamp,
        params.jobId || params.id || '',
        params.title || '',
        params.company || '',
        params.category || 'Tech',
        params.jobType || 'Full-Time',
        params.location || 'Multiple Locations / Hybrid',
        params.experience || 'All Levels',
        params.salary || 'Best in Industry',
        params.skills || '',
        params.description || '',
        params.applyUrl || '',
        params.isDirectLink ? 'Yes' : 'No'
      ]);

      return createJsonResponse({
        status: 'success',
        sheet: 'Job_Openings',
        message: 'Job opening recorded successfully in Google Sheet'
      });
    }

    // =========================================================================
    // ROUTE 5: Delete Job Opening from Google Sheet
    // =========================================================================
    else if (type === 'delete_job') {
      var jobSheet = ss.getSheetByName('Job_Openings');
      var deleted = 0;
      if (jobSheet) {
        var targetId = String(params.jobId || params.id || '').trim();
        var targetTitle = String(params.title || '').trim().toLowerCase();
        var lastRow = jobSheet.getLastRow();
        if (lastRow > 1) {
          var vals = jobSheet.getRange(1, 1, lastRow, 4).getValues();
          for (var j = vals.length - 1; j >= 1; j--) {
            var rowId = String(vals[j][1] || '').trim();
            var rowTitle = String(vals[j][2] || '').trim().toLowerCase();
            if ((targetId && rowId === targetId) || (targetTitle && rowTitle === targetTitle)) {
              jobSheet.deleteRow(j + 1);
              deleted++;
            }
          }
        }
      }
      return createJsonResponse({
        status: 'success',
        deletedRows: deleted,
        message: 'Job removed from Job_Openings sheet'
      });
    }

    // =========================================================================
    // ROUTE 6: Course Enrollments & Inquiries (Dedicated Course_Enrollments Tab)
    // =========================================================================
    else {
      var enrollHeaders = [
        'Timestamp',
        'Full Name',
        'Email Address',
        'Phone Number',
        'Enrolled Course',
        'Highest Qualification',
        'Learning Mode',
        'Current Professional Status',
        'Preferred Batch Timing',
        'Additional Notes / Comments',
        'Page URL'
      ];

      var enrollSheet = getOrCreateSheet(ss, 'Course_Enrollments', enrollHeaders, '#0284c7'); // Ocean blue header

      // Deduplication: prevent identical back-to-back submissions
      var lastRow = enrollSheet.getLastRow();
      if (lastRow > 1) {
        var lastVals = enrollSheet.getRange(lastRow, 1, 1, 5).getValues()[0];
        var lastTs = String(lastVals[0] || '').trim();
        var lastNm = String(lastVals[1] || '').trim().toLowerCase();
        var lastEm = String(lastVals[2] || '').trim().toLowerCase();
        var lastPh = String(lastVals[3] || '').trim();

        var thisNm = String(params.name || '').trim().toLowerCase();
        var thisEm = String(params.email || '').trim().toLowerCase();
        var thisPh = String(params.phone || '').trim();

        if (lastTs === String(timestamp).trim() || (thisEm && lastEm === thisEm && (lastPh === thisPh || lastNm === thisNm))) {
          return createJsonResponse({
            status: 'success',
            sheet: 'Course_Enrollments',
            message: 'Duplicate ignored — single row preserved'
          });
        }
      }

      var enrolledCourseName = params.enrolledCourse || params.course || params.role || 'Course Enrollment';

      enrollSheet.appendRow([
        timestamp,
        params.name || '',
        params.email || '',
        params.phone || '',
        enrolledCourseName,
        params.qualification || '',
        params.learningMode || params.mode || '',
        params.status || params.currentStatus || '',
        params.batchTime || params.batch || '',
        params.comments || params.notes || '',
        params.page || ''
      ]);

      return createJsonResponse({
        status: 'success',
        sheet: 'Course_Enrollments',
        message: 'Course enrollment recorded successfully for: ' + enrolledCourseName
      });
    }

  } catch (error) {
    return createJsonResponse({ status: 'error', message: error.toString() });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper: Find or create a sheet tab with formatted headers.
 * Automatically checks each column up to headers.length and creates missing headers (e.g. Column P).
 */
function getOrCreateSheet(spreadsheet, sheetName, headers, headerColor) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground(headerColor || '#1e293b');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    
    for (var i = 1; i <= headers.length; i++) {
      sheet.setColumnWidth(i, i === 16 ? 220 : 170);
    }
  } else {
    // If sheet already exists, verify each header column and add any missing headers (e.g. Column P)
    for (var col = 1; col <= headers.length; col++) {
      var cell = sheet.getRange(1, col);
      var currentVal = cell.getValue();
      if (!currentVal || String(currentVal).trim() === '') {
        cell.setValue(headers[col - 1]);
        cell.setBackground(headerColor || '#1e293b');
        cell.setFontColor('#ffffff');
        cell.setFontWeight('bold');
        cell.setHorizontalAlignment('center');
        sheet.setColumnWidth(col, col === 16 ? 220 : 170);
      }
    }
  }
  return sheet;
}

/**
 * Run this function directly from the Apps Script editor menu to
 * immediately format and add Column P ("Resume PDF (Click to Open)") to the sheet!
 */
function setupResumeColumn() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Job_Applications');
  if (sheet) {
    var cell = sheet.getRange(1, 16);
    cell.setValue('Resume PDF (Click to Open)');
    cell.setBackground('#047857');
    cell.setFontColor('#ffffff');
    cell.setFontWeight('bold');
    cell.setHorizontalAlignment('center');
    sheet.setColumnWidth(16, 220);
    SpreadsheetApp.flush();
    Logger.log('Column P added successfully to Job_Applications!');
  } else {
    Logger.log('Job_Applications sheet not found.');
  }
}

/**
 * Run this function directly from the Apps Script editor menu to
 * immediately create and format the "Course_Enrollments" tab in your Google Sheet!
 */
function setupCourseEnrollmentsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var enrollHeaders = [
    'Timestamp',
    'Full Name',
    'Email Address',
    'Phone Number',
    'Enrolled Course',
    'Highest Qualification',
    'Learning Mode',
    'Current Professional Status',
    'Preferred Batch Timing',
    'Additional Notes / Comments',
    'Page URL'
  ];
  var sheet = getOrCreateSheet(ss, 'Course_Enrollments', enrollHeaders, '#0284c7');
  SpreadsheetApp.flush();
  Logger.log('"Course_Enrollments" tab created and formatted successfully with "Enrolled Course" column!');
}

/**
 * Run this function directly from the Apps Script editor menu to
 * immediately create and format the "Course_Login_Details" tab in your Google Sheet!
 */
function setupCourseLoginSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var authHeaders = [
    'Timestamp',
    'Full Name',
    'Email Address',
    'Phone Number',
    'Password',
    'Auth Type',
    'Action',
    'Section',
    'Page URL'
  ];
  var sheet = getOrCreateSheet(ss, 'Course_Login_Details', authHeaders, '#4f46e5');
  SpreadsheetApp.flush();
  Logger.log('"Course_Login_Details" tab created and formatted successfully!');
}

/**
 * Run this function directly from the Apps Script editor menu to
 * immediately create and format the "Users_Auth" tab in your Google Sheet!
 */
function setupUsersAuthSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var authHeaders = [
    'Timestamp',
    'Full Name',
    'Email Address',
    'Phone Number',
    'Password',
    'Auth Type',
    'Action',
    'Section',
    'Page URL'
  ];
  var sheet = getOrCreateSheet(ss, 'Users_Auth', authHeaders, '#1d4ed8');
  SpreadsheetApp.flush();
  Logger.log('"Users_Auth" tab created and formatted successfully!');
}

/**
 * Helper: Find a user across auth sheets (Users_Auth, Course_Login_Details)
 * Enables Course Details login to verify credentials against Users_Auth.
 */
function findUserInAuthSheets(ss, email, password) {
  if (!email) return null;
  var sheetsToCheck = ['Users_Auth', 'Course_Login_Details', 'Login_Signup_Details'];
  for (var s = 0; s < sheetsToCheck.length; s++) {
    var sheet = ss.getSheetByName(sheetsToCheck[s]);
    if (!sheet) continue;
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) continue;
    var data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    for (var i = data.length - 1; i >= 0; i--) {
      var rowEmail = String(data[i][2] || '').trim().toLowerCase();
      var rowPass = String(data[i][4] || '').trim();
      var rowName = String(data[i][1] || '').trim();
      var rowPhone = String(data[i][3] || '').trim();
      if (rowEmail === email.toLowerCase()) {
        if (!password || !rowPass || rowPass === password) {
          return {
            name: rowName,
            email: rowEmail,
            phone: rowPhone,
            sourceSheet: sheetsToCheck[s]
          };
        }
      }
    }
  }
  return null;
}

/**
 * ONE-CLICK REMOVAL FUNCTION:
 * Run this function in the Apps Script editor toolbar to instantly delete
 * obsolete legacy sheets: "Course_Leads", "Course Leads", and "Job Leads"!
 */
function removeUnwantedSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetsToRemove = ['Course_Leads', 'Course Leads', 'Job Leads'];
  var removed = [];

  sheetsToRemove.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (sheet) {
      ss.deleteSheet(sheet);
      removed.push(name);
      Logger.log('Deleted sheet: "' + name + '"');
    }
  });

  SpreadsheetApp.flush();
  if (removed.length > 0) {
    Logger.log('Successfully removed: ' + removed.join(', '));
  } else {
    Logger.log('None of the sheets were found (they may already be deleted).');
  }
}

/**
 * ONE-CLICK CLEANUP FUNCTION:
 * Run this function in the Apps Script editor to instantly remove
 * all existing duplicate rows from the Job_Applications sheet!
 */
function removeDuplicateRows() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Job_Applications');
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();
  if (data.length <= 2) return;

  var seen = {};
  var rowsToDelete = [];

  // Iterate from row 2 (index 1) downward
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    // Signature based on timestamp, name, email
    var sig = String(row[0]).trim() + '|' + String(row[1]).trim().toLowerCase() + '|' + String(row[3]).trim().toLowerCase();
    if (seen[sig]) {
      rowsToDelete.push(i + 1); // 1-indexed row number
    } else {
      seen[sig] = true;
    }
  }

  // Delete duplicate rows from bottom to top so indices don't shift
  for (var r = rowsToDelete.length - 1; r >= 0; r--) {
    sheet.deleteRow(rowsToDelete[r]);
  }

  Logger.log('Cleaned up ' + rowsToDelete.length + ' duplicate rows successfully!');
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
