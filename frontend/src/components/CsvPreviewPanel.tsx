import { useRef, useState, type ChangeEvent } from 'react';
import apiFetch from '../api';
import { useToast } from '../context/ToastContext';

type PreviewUser = {
    name: string;
    email: string;
    funcNumber: string;
    documentId: string;
    phoneNumber: string | null;
    role: 'user' | 'admin';
};

type PreviewError = {
    row: number;
    data: PreviewUser;
    reasons: string[];
};

type PreviewResult = {
    summary: { totalReceived: number; validCount: number; errorCount: number };
    validRows: PreviewUser[];
    errors: PreviewError[];
    duplicates: { emails: string[]; funcs: string[]; docs: string[] };
};

const REQUIRED_HEADERS = ['name', 'email', 'funcnumber', 'documentid'];

const normalizeHeader = (header: unknown) =>
    String(header || '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, '');

const toApiKey = (header: string) => {
    if (header === 'funcnumber') return 'funcNumber';
    if (header === 'documentid') return 'documentId';
    if (header === 'phonenumber') return 'phoneNumber';
    return header;
};

const hasDuplicates = (values: string[]) => values.some(Boolean);

export default function CsvPreviewPanel() {
    const { success, error } = useToast();
    const [loading, setLoading] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const [result, setResult] = useState<PreviewResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.csv')) {
            error('Seleccioná un archivo CSV.');
            event.target.value = '';
            return;
        }

        setLoading(true);
        setResult(null);
        setFileName(file.name);

        try {
            const XLSX = await import('xlsx');
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[worksheetName];

            if (!worksheet) {
                throw new Error('No se pudo leer la primera hoja del archivo.');
            }

            const rawRows = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1, defval: '' });

            if (rawRows.length < 2) {
                throw new Error('El archivo está vacío o no tiene filas de datos.');
            }

            const normalizedHeaders = rawRows[0].map(normalizeHeader);
            const missingHeaders = REQUIRED_HEADERS.filter(header => !normalizedHeaders.includes(header));

            if (missingHeaders.length > 0) {
                throw new Error('Faltan columnas obligatorias: name, email, funcNumber, documentId.');
            }

            const dataRows = rawRows
                .slice(1)
                .filter(row => row.some(cell => String(cell).trim() !== ''));

            if (dataRows.length === 0) {
                throw new Error('El archivo no tiene usuarios para validar.');
            }

            if (dataRows.length > 500) {
                throw new Error('El archivo supera el límite de 500 filas.');
            }

            const users = dataRows.map(row => {
                const user: Record<string, string> = {};

                normalizedHeaders.forEach((header, index) => {
                    if (!header) return;
                    const key = toApiKey(header);
                    if (!['name', 'email', 'funcNumber', 'documentId', 'phoneNumber', 'role'].includes(key)) return;
                    user[key] = String(row[index] || '').trim();
                });

                return user;
            });

            const preview = await apiFetch<PreviewResult>('/api/admin/users/preview-csv', {
                method: 'POST',
                body: JSON.stringify({ users }),
            });

            setResult(preview);
            success('Archivo validado. No se creó ningún usuario.');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error al leer el archivo';
            error(message);
        } finally {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <section className="admin-panel" style={{ marginTop: '2rem', border: '1px solid var(--border)' }}>
            <div className="admin-panel-header">
                <div>
                    <span className="admin-panel-title">Carga masiva de usuarios</span>
                    <span className="badge badge-gray" style={{ marginLeft: '0.5rem' }}>Solo SuperAdmin</span>
                </div>
            </div>

            <div style={{ padding: '1.5rem' }}>
                <p className="muted" style={{ marginBottom: '1rem', lineHeight: 1.5 }}>
                    Esta acción no crea usuarios ni envía correos. Solo valida el archivo antes de una futura importación.
                </p>
                <p className="muted" style={{ marginBottom: '1.5rem', lineHeight: 1.5 }}>
                    Columnas esperadas: <code>name, email, funcNumber, documentId, phoneNumber, role</code>
                </p>

                <input
                    id="csv-upload"
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileChange}
                    disabled={loading}
                    style={{ display: 'none' }}
                />
                <label
                    htmlFor="csv-upload"
                    className={`btn btn-primary ${loading ? 'disabled' : ''}`}
                    style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                    {loading ? 'Validando archivo...' : 'Seleccionar CSV y validar'}
                </label>

                {fileName && (
                    <span className="muted" style={{ marginLeft: '1rem', fontSize: '0.9rem' }}>
                        {fileName}
                    </span>
                )}

                {result && (
                    <div style={{ marginTop: '2rem' }}>
                        <div className="grid-3" style={{ gap: '1rem', marginBottom: '2rem' }}>
                            <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                                <p className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Recibidos</p>
                                <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{result.summary.totalReceived}</p>
                            </div>
                            <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', borderLeft: '4px solid var(--success)' }}>
                                <p className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Válidos</p>
                                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>{result.summary.validCount}</p>
                            </div>
                            <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', borderLeft: '4px solid var(--danger)' }}>
                                <p className="muted" style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Con errores</p>
                                <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--danger)' }}>{result.summary.errorCount}</p>
                            </div>
                        </div>

                        {hasDuplicates([...result.duplicates.emails, ...result.duplicates.funcs, ...result.duplicates.docs]) && (
                            <div style={{ marginBottom: '2rem', padding: '1rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
                                <h4 style={{ marginBottom: '0.75rem' }}>Duplicados contra el sistema</h4>
                                {result.duplicates.emails.length > 0 && <p className="muted">Emails: {result.duplicates.emails.join(', ')}</p>}
                                {result.duplicates.funcs.length > 0 && <p className="muted">Funcionarios: {result.duplicates.funcs.join(', ')}</p>}
                                {result.duplicates.docs.length > 0 && <p className="muted">Documentos: {result.duplicates.docs.join(', ')}</p>}
                            </div>
                        )}

                        {result.errors.length > 0 && (
                            <div style={{ marginBottom: '2rem' }}>
                                <h4 style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Filas con errores</h4>
                                <div className="admin-table-wrap">
                                    <table className="res-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '80px' }}>Fila</th>
                                                <th>Usuario</th>
                                                <th>Motivos</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.errors.map(row => (
                                                <tr key={`${row.row}-${row.data.email}`}>
                                                    <td><span className="badge badge-danger">#{row.row}</span></td>
                                                    <td>
                                                        <div className="user-name">{row.data.name || 'Sin nombre'}</div>
                                                        <div className="user-meta">{row.data.email || 'Sin email'}</div>
                                                    </td>
                                                    <td>
                                                        <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--danger)', fontSize: '0.85rem' }}>
                                                            {row.reasons.map(reason => (
                                                                <li key={reason}>{reason}</li>
                                                            ))}
                                                        </ul>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {result.validRows.length > 0 && (
                            <div>
                                <h4 style={{ color: 'var(--success)', marginBottom: '1rem' }}>Filas válidas</h4>
                                <div className="admin-table-wrap">
                                    <table className="res-table">
                                        <thead>
                                            <tr>
                                                <th>Nombre</th>
                                                <th>Email</th>
                                                <th>Funcionario</th>
                                                <th>Documento</th>
                                                <th>Rol</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.validRows.slice(0, 10).map((user, index) => (
                                                <tr key={`${user.email}-${index}`}>
                                                    <td><div className="user-name">{user.name}</div></td>
                                                    <td><div className="user-meta">{user.email}</div></td>
                                                    <td>{user.funcNumber}</td>
                                                    <td>{user.documentId}</td>
                                                    <td><span className="badge badge-gray">{user.role}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {result.validRows.length > 10 && (
                                    <p className="muted" style={{ marginTop: '0.75rem', fontSize: '0.9rem', textAlign: 'center' }}>
                                        Hay {result.validRows.length - 10} filas válidas más.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
