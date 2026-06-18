import Layout from '../components/Layout';
import { useSettings } from '../context/SettingsContext';

const UPDATED = '18 de junio de 2026';

export default function PrivacyPolicyPage() {
    const { settings } = useSettings();
    const company = settings.companyName || 'Real Sabor';
    const email = settings.supportEmail || 'soporte@reservasrealsabor.com.uy';

    const h = { color: 'var(--accent)', marginTop: '2rem', marginBottom: '0.75rem', fontSize: '1.15rem' } as const;
    const p = { lineHeight: 1.7, marginBottom: '0.75rem', color: 'var(--text)' } as const;

    return (
        <Layout title="Política de Privacidad" subtitle={`Última actualización: ${UPDATED}`} showLogout={false}>
            <div className="card" style={{ maxWidth: 820, margin: '0 auto', padding: '2rem', lineHeight: 1.7 }}>
                <p style={p}>
                    En <strong>{company}</strong> nos tomamos en serio la protección de tus datos personales.
                    Esta política explica qué datos tratamos, con qué finalidad, durante cuánto tiempo y qué
                    derechos tenés. El tratamiento se realiza conforme a la <strong>Ley N° 18.331 de Protección
                    de Datos Personales</strong> de la República Oriental del Uruguay y su normativa reglamentaria.
                </p>

                <h2 style={h}>1. Responsable del tratamiento</h2>
                <p style={p}>
                    El responsable del tratamiento de los datos es <strong>{company}</strong>. Para cualquier
                    consulta sobre esta política o el ejercicio de tus derechos podés escribir a{' '}
                    <a href={`mailto:${email}`} style={{ color: 'var(--accent)' }}>{email}</a>.
                </p>

                <h2 style={h}>2. Datos que recolectamos</h2>
                <p style={p}>Para la prestación del servicio de reservas de menú recolectamos:</p>
                <ul style={{ lineHeight: 1.8, paddingLeft: '1.25rem', color: 'var(--text)' }}>
                    <li>Datos de identificación: nombre, apellido y documento de identidad (CI).</li>
                    <li>Datos de contacto: correo electrónico y teléfono.</li>
                    <li>Número de funcionario.</li>
                    <li>Foto de perfil (para identificación al retirar la comida).</li>
                    <li>Credenciales de acceso: contraseña almacenada de forma cifrada (nunca en texto plano).</li>
                    <li>Datos de uso del servicio: reservas de menú, horarios de retiro y calificaciones de platos.</li>
                    <li>Datos técnicos mínimos necesarios para la seguridad y el funcionamiento (por ejemplo, registros de acceso).</li>
                </ul>

                <h2 style={h}>3. Finalidad del tratamiento</h2>
                <p style={p}>Usamos tus datos para:</p>
                <ul style={{ lineHeight: 1.8, paddingLeft: '1.25rem', color: 'var(--text)' }}>
                    <li>Gestionar tu cuenta y permitirte reservar el menú semanal.</li>
                    <li>Identificarte para la entrega de las comidas.</li>
                    <li>Enviarte comunicaciones operativas (verificación de cuenta, recordatorios de cierre, avisos del servicio).</li>
                    <li>Elaborar estadísticas internas y mejorar la calidad del menú a partir de las calificaciones.</li>
                    <li>Cumplir con obligaciones legales aplicables.</li>
                </ul>

                <h2 style={h}>4. Base legal</h2>
                <p style={p}>
                    El tratamiento se basa en tu <strong>consentimiento</strong> (otorgado al registrarte y aceptar
                    esta política) y en la necesidad de ejecutar el servicio de comedor en el marco de la relación
                    con la empresa.
                </p>

                <h2 style={h}>5. Conservación de los datos</h2>
                <p style={p}>
                    Conservamos tus datos mientras mantengas una cuenta activa y exista la relación con el servicio.
                    Cuando esa relación finaliza, los datos se eliminan o anonimizan en un plazo razonable, salvo que
                    deban conservarse por una obligación legal.
                </p>

                <h2 style={h}>6. Terceros y encargados del tratamiento</h2>
                <p style={p}>
                    Para operar el servicio utilizamos proveedores que actúan como encargados del tratamiento, bajo
                    medidas de seguridad adecuadas: alojamiento de la aplicación y base de datos, almacenamiento de
                    imágenes de perfil y envío de correos electrónicos. Algunos de estos proveedores pueden procesar
                    datos fuera de Uruguay; en esos casos procuramos garantías adecuadas para la transferencia
                    internacional. No vendemos ni cedemos tus datos a terceros con fines comerciales.
                </p>

                <h2 style={h}>7. Tus derechos</h2>
                <p style={p}>
                    Como titular de los datos podés ejercer los derechos de <strong>acceso, rectificación,
                    actualización, supresión e inclusión</strong>, así como oponerte al tratamiento, escribiéndonos a{' '}
                    <a href={`mailto:${email}`} style={{ color: 'var(--accent)' }}>{email}</a>. También tenés derecho a
                    presentar reclamos ante la <strong>Unidad Reguladora y de Control de Datos Personales (URCDP)</strong>.
                </p>

                <h2 style={h}>8. Seguridad</h2>
                <p style={p}>
                    Aplicamos medidas técnicas y organizativas para proteger tus datos: cifrado de contraseñas,
                    conexiones seguras (HTTPS), control de acceso por roles y límites para prevenir abusos. Ningún
                    sistema es 100% infalible, pero trabajamos para minimizar los riesgos.
                </p>

                <h2 style={h}>9. Cookies y almacenamiento local</h2>
                <p style={p}>
                    Utilizamos almacenamiento local del navegador únicamente para el funcionamiento del servicio
                    (por ejemplo, mantener tu sesión iniciada y tus preferencias de visualización). No usamos cookies
                    de publicidad ni de seguimiento de terceros.
                </p>

                <h2 style={h}>10. Cambios en esta política</h2>
                <p style={p}>
                    Podemos actualizar esta política para reflejar cambios legales o del servicio. La versión vigente
                    será siempre la publicada en esta página, con su fecha de última actualización.
                </p>

                <h2 style={h}>11. Contacto</h2>
                <p style={{ ...p, marginBottom: 0 }}>
                    Ante cualquier duda sobre el tratamiento de tus datos personales, escribinos a{' '}
                    <a href={`mailto:${email}`} style={{ color: 'var(--accent)' }}>{email}</a>.
                </p>
            </div>
        </Layout>
    );
}
