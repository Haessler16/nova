export const metadata = {
  title: 'Sin conexión — NOVA PMS',
};

export default function OfflinePage() {
  return (
    <main
      id="main-content"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        fontFamily: 'system-ui, sans-serif',
        background: '#f7f8fa',
        color: '#1a202c',
      }}
    >
      <section
        aria-labelledby="offline-title"
        style={{
          maxWidth: '480px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '32px',
          textAlign: 'center',
        }}
      >
        <h1 id="offline-title" style={{ fontSize: '24px', marginBottom: '12px' }}>
          Sin conexión
        </h1>
        <p style={{ color: '#4a5568', lineHeight: 1.6, marginBottom: '20px' }}>
          NOVA PMS necesita conexión para leer y modificar datos operativos. Las operaciones no
          enviadas no se muestran como confirmadas; reintentá cuando vuelvas a estar en línea.
        </p>
        <a
          href="/dashboard"
          style={{
            display: 'inline-block',
            background: '#1a365d',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Reintentar
        </a>
      </section>
    </main>
  );
}
