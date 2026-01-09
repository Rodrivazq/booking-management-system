import { Request, Response } from 'express';
import QRCode from 'qrcode';
import { BASE_URL } from '../config/env';

export const generateQR = async (req: Request, res: Response) => {
    const url = req.query.url || BASE_URL;
    try {
        const dataUrl = await QRCode.toDataURL(String(url), { width: 320 });
        res.json({ dataUrl, url });
    } catch (err) {
        res.status(500).json({ error: 'No se pudo generar el QR' });
    }
};
