import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'OceanEmbed | North Indian Ocean Subsurface Intelligence',
  description: 'Deep Learning Reconstruction of Subsurface Ocean Temperature from Satellite-Derived Observations (INCOIS / SIH).',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="official-banner">
          <div>
            <strong>INCOIS / MoES</strong> — Ministry of Earth Sciences, Government of India &middot; Smart India Hackathon
          </div>
          <div>
            <span className="status-tag">
              DEMO / MODEL DEVELOPMENT DATA
            </span>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
