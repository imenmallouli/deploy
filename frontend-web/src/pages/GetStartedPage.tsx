import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAlerts, listDtc, listVehicles } from '../lib/api/endpoints';

export function GetStartedPage() {
  const [showWelcome, setShowWelcome] = useState(true);
  const vehiclesQuery = useQuery({ queryKey: ['vehicles'], queryFn: listVehicles });
  const alertsQuery = useQuery({ queryKey: ['alerts'], queryFn: listAlerts });
  const dtcQuery = useQuery({ queryKey: ['dtc'], queryFn: () => listDtc(20) });

  const totalVehicles = vehiclesQuery.data?.count ?? 0;
  const pendingAlerts = alertsQuery.data?.pending ?? 0;

  return (
    <section className="overview-page panel get-started-shell">
      <div className="panel-title-row">
        <h2>Get started</h2>
        {showWelcome && (
          <button className="btn-link" type="button" onClick={() => setShowWelcome(false)}>
            Close
          </button>
        )}
      </div>

      {showWelcome && (
        <article className="get-started-hero">
          <div>
            <h3>Discover, Shop, Learn, and Thrive with MALLOULIAUTO Cloud</h3>
            <p>
              Manage your fleet operations, diagnostics and connected devices from one place.
              Vehicles: {totalVehicles} · Open alerts: {pendingAlerts} · DTC: {dtcQuery.data?.count ?? 0}
            </p>
            <button className="btn-primary" type="button">Get expert guidance</button>
          </div>
          <div className="get-started-hero-device" aria-hidden="true">OBD</div>
        </article>
      )}

      <h3 className="get-started-section-title">Shortcuts</h3>
      <div className="get-started-shortcuts">
        <article className="get-started-tile"><span>📘</span><p>Documentation</p></article>
        <article className="get-started-tile"><span>💻</span><p>API Reference</p></article>
        <article className="get-started-tile"><span>🎧</span><p>Support</p></article>
      </div>

      <h3 className="get-started-section-title">Telematics</h3>
      <h3 className="get-started-subtitle">Real-Time Vehicle Intelligence</h3>
      <article className="get-started-banner">
        <div className="get-started-banner-image" aria-hidden="true">Device</div>
        <div>
          <h3>Struggling with accessing real-time vehicle data?</h3>
          <p>Explore our telematics and diagnostics modules to elevate your data insights.</p>
          <button className="btn-primary" type="button">Check our prices</button>
        </div>
      </article>

      <h3 className="get-started-section-title">Business</h3>
      <h3 className="get-started-subtitle">Auto Diagnostic IoT solutions</h3>
      <div className="get-started-business-grid">
        <article className="get-started-business-card">Data Management</article>
        <article className="get-started-business-card">Device Management</article>
        <article className="get-started-business-card">Electric Vehicle</article>
        <article className="get-started-business-card">Fleet Management</article>
        <article className="get-started-business-card">Real-time Data Streaming</article>
        <article className="get-started-business-card">Vehicle Telematics</article>
      </div>

      <h3 className="get-started-section-title">Blog</h3>
      <h3 className="get-started-subtitle">Latest fleet and diagnostics posts</h3>
      <div className="get-started-blog-grid">
        <article className="get-started-blog-card"><h4>CAN BUS Protocol</h4><p>Ultimate CAN BUS Guide 2023: A detailed look at the protocol.</p></article>
        <article className="get-started-blog-card"><h4>Raspberry Pi Car Computer</h4><p>How to build a Raspberry Pi car computer in easy steps.</p></article>
        <article className="get-started-blog-card"><h4>OBD-II</h4><p>Ultimate OBD2 Guide: Understanding vehicle diagnostics.</p></article>
      </div>
    </section>
  );
}
