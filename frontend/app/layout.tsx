import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OceanEmbed | Subsurface Ocean Intelligence Dashboard',
  description: 'GNN-Hybrid Deep Learning Subsurface Ocean Temperature Reconstruction, Marine Heatwave & Cyclone Heat Content Intelligence (INCOIS / MoES).',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="official-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <span style={{ fontWeight: 800, color: '#38bdf8', letterSpacing: '0.04em' }}>
              INCOIS / MoES
            </span>
            <span style={{ color: '#64748b' }}>&vert;</span>
            <span>Indian National Centre for Ocean Information Services</span>
            <span style={{ color: '#64748b' }}>&vert;</span>
            <span style={{ color: '#94a3b8' }}>Smart India Hackathon 2024–2026</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.73rem', color: '#94a3b8' }}>
              <span style={{ color: '#0df2c9', fontWeight: 600 }}>DOMAIN:</span>
              <span>North Indian Ocean (5°N–30°N, 45°E–105°E) &middot; 0.25°</span>
            </div>
            <span className="status-tag pulse">
              OPERATIONAL CORE v0.3.0
            </span>
          </div>
        </div>

        {children}
      </body>
    </html>
  );
}
