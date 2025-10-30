/**
 * 404 Not Found page component
 */
export const dynamic = 'force-dynamic';

export default function NotFound() {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '1rem',
            padding: '1rem'
        }}>
            <h1 style={{ fontSize: '4rem', fontWeight: 'bold', margin: 0 }}>404</h1>
            <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Page Not Found</h2>
            <p style={{ textAlign: 'center', maxWidth: '400px' }}>
                The page you're looking for doesn't exist or has been moved.
            </p>
            <a
                href="/dashboard"
                style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#007bff',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '4px'
                }}
            >
                Go to Dashboard
            </a>
        </div>
    );
}