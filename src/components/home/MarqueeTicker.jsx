import React from 'react';

const partners = [
  "Cognizant", "Tata Consultancy Services (TCS)", "IBS Software", "ISRO", 
  "Neologix", "MariApps Marine", "Aion Pixel", "ClaySys", 
  "Sioniq", "Evalogic", "Aabosoft Technologies", "UST Global", "Infosys"
];

export default function MarqueeTicker() {
  return (
    <div 
      style={{ 
        background: '#FFFFFF', 
        padding: '24px 0', 
        borderBottom: '1px solid rgba(10, 21, 48, 0.06)',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <div 
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '100px',
          background: 'linear-gradient(90deg, #FFFFFF 0%, rgba(255,255,255,0) 100%)',
          zIndex: 2,
          pointerEvents: 'none'
        }}
      />
      <div 
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: '100px',
          background: 'linear-gradient(270deg, #FFFFFF 0%, rgba(255,255,255,0) 100%)',
          zIndex: 2,
          pointerEvents: 'none'
        }}
      />

      <div style={{ textAlign: 'center', marginBottom: '14px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Our Alumni Build and Lead At Leading Global Companies
        </span>
      </div>

      <div className="marquee-track">
        {[...partners, ...partners].map((name, i) => (
          <div 
            key={i} 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '12px', 
              padding: '8px 24px', 
              fontSize: '15px', 
              fontWeight: 700, 
              color: '#474F66',
              whiteSpace: 'nowrap'
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#0E2EC9', display: 'inline-block' }} />
            <span>{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
