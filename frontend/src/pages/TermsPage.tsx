import Layout from '../components/Layout';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

const UPDATED = '18 de junio de 2026';

export default function TermsPage() {
    const { settings } = useSettings();
    const company = settings.companyName || 'Real Sabor';
    const email = settings.supportEmail || 'soporte@empresa.com';

    const h = { color: 'var(--accent)', marginTop: '2rem', marginBottom: '0.75rem', fontSize: '1.15rem' } as const;
    const p = { lineHeight: 1.7, marginBottom: '0.75rem', color: 'var(--text)' } as const;

    return (
        <Layout title="Términos y Condiciones de Uso" subtitle={`Última actualización: ${UPDATED}`} showLogout={false}>
            <div className="card" style={{ maxWidth: 820, margin: '0 auto', padding: '2rem', lineHeight: 1.7 }}>
                <p style={p}>
                    Estos Términos y Condiciones regulan el uso de la plataforma de reservas de menú de{' '}
                    <strong>{company}</strong> (en adelante, "el Servicio"). Al crear una cuenta y utilizar el
                    Servicio, aceptás estos términos en su totalidad.
                </p>

                <h2 style={h}>1. Objeto del Servicio</h2>
                <p style={p}>
                    El Servicio permite a los funcionarios habilitados reservar su menú semanal, indicar horario de
                    retiro y calificar los platos. No constituye una tienda en línea: no se realizan pagos ni
                    transacciones comerciales a través de la plataforma.
                </p>

                <h2 style={h}>2. Cuenta y registro</h2>
                <p style={p}>
                    Para usar el Servicio debés registrarte con datos veraces, completos y actualizados, y verificar
                    tu correo electrónico. Sos responsable de la confidencialidad de tu contraseña y de toda actividad
                    realizada desde tu cuenta. Notificá de inmediato cualquier uso no autorizado.
                </p>

                <h2 style={h}>3. Uso permitido</h2>
                <p style={p}>Te comprometés a utilizar el Servicio de forma lícita y de buena fe. En particular, no podés:</p>
                <ul style={{ lineHeight: 1.8, paddingLeft: '1.25rem', color: 'var(--text)' }}>
                    <li>Suplantar la identidad de otra persona o usar datos falsos.</li>
                    <li>Intentar acceder a cuentas o datos ajenos.</li>
                    <li>Interferir con el funcionamiento o la seguridad de la plataforma.</li>
                    <li>Cargar contenido (por ejemplo, fotos) ilícito, ofensivo o que infrinja derechos de terceros.</li>
                </ul>

                <h2 style={h}>4. Reservas y plazos</h2>
                <p style={p}>
                    Las reservas deben realizarse dentro de la ventana habilitada y antes del día y hora de cierre que
                    se indiquen en el Servicio. Una vez cerrado el plazo, las reservas no podrán modificarse, salvo
                    excepciones habilitadas por un administrador.
                </p>

                <h2 style={h}>5. Disponibilidad del Servicio</h2>
                <p style={p}>
                    Procuramos mantener el Servicio disponible y funcionando correctamente, pero no garantizamos su
                    operación ininterrumpida ni libre de errores. Podremos realizar tareas de mantenimiento o
                    actualizaciones que afecten temporalmente la disponibilidad.
                </p>

                <h2 style={h}>6. Datos personales</h2>
                <p style={p}>
                    El tratamiento de tus datos personales se rige por nuestra{' '}
                    <Link to="/privacidad" style={{ color: 'var(--accent)' }}>Política de Privacidad</Link>, que forma
                    parte de estos términos.
                </p>

                <h2 style={h}>7. Responsabilidad</h2>
                <p style={p}>
                    El Servicio se brinda "tal cual". En la medida permitida por la ley, {company} no será responsable
                    por daños indirectos derivados del uso o la imposibilidad de uso de la plataforma. Nada en estos
                    términos limita responsabilidades que no puedan excluirse legalmente.
                </p>

                <h2 style={h}>8. Modificaciones</h2>
                <p style={p}>
                    Podemos actualizar estos términos. La versión vigente será la publicada en esta página. El uso
                    continuado del Servicio luego de una actualización implica la aceptación de los nuevos términos.
                </p>

                <h2 style={h}>9. Ley aplicable y jurisdicción</h2>
                <p style={p}>
                    Estos términos se rigen por las leyes de la República Oriental del Uruguay. Cualquier controversia
                    se someterá a los tribunales competentes de Uruguay.
                </p>

                <h2 style={h}>10. Contacto</h2>
                <p style={{ ...p, marginBottom: 0 }}>
                    Por consultas sobre estos términos, escribinos a{' '}
                    <a href={`mailto:${email}`} style={{ color: 'var(--accent)' }}>{email}</a>.
                </p>
            </div>
        </Layout>
    );
}
