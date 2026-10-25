export function createAgentReviewer() {
  let worker=null,sequence=0;
  const tasks=new Map();
  function reset() {
    worker?.terminate();worker=null;
    for(const task of tasks.values()){clearTimeout(task.timer);task.reject(Error('AI review cancelled'));}
    tasks.clear();
  }
  function review(items,onProgress=()=>{}) {
    if(!worker) {
      worker=new Worker('/js/local-ai-worker.mjs',{type:'module'});
      worker.onmessage=({data})=>{
        const task=tasks.get(data.taskId);if(!task)return;
        if(data.type==='status')task.onProgress(data.text);
        if(data.type==='agent-complete' || data.type==='agent-error') {
          clearTimeout(task.timer);tasks.delete(data.taskId);
          if(data.type==='agent-error')task.reject(Error(data.message));else task.resolve(data.results);
        }
      };
      worker.onerror=()=>reset();
    }
    const taskId=++sequence;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reset(),60000);
      tasks.set(taskId,{resolve,reject,onProgress,timer});
      worker.postMessage({type:'agent-review',taskId,items});
    });
  }
  return {review,reset};
}
