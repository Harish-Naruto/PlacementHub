import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { ApiError } from '../utils/apiError';

export type ResumeKind = 'pdf' | 'docx';

// Detect by magic bytes, not by filename/mimetype.
export function detectKind(buf: Buffer): ResumeKind | null {
    if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
    if (buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return 'docx';
    return null;
}

const MIN_TEXT_CHARS = 50;

export async function extractText(buf: Buffer): Promise<string> {
    const kind = detectKind(buf);
    if (!kind) throw new ApiError('Only PDF and DOCX resumes are supported', 415, true, 'UNSUPPORTED_FILE_TYPE');

    let text: string;
    try {
        if (kind === 'pdf') {
            const parser = new PDFParse({ data: new Uint8Array(buf) });
            try {
                // Page markers let the LLM fill in `page` for evidence.
                const res = await parser.getText();
                text = res.pages.map((p) => `[Page ${p.num}]\n${p.text}`).join('\n\n');
            } finally {
                await parser.destroy();
            }
        } else {
            text = (await mammoth.extractRawText({ buffer: buf })).value;
        }
    } catch {
        throw new ApiError('Could not read the resume file; it may be corrupted', 422, true, 'INVALID_FILE');
    }

    if (text.replace(/\[Page \d+\]/g, '').trim().length < MIN_TEXT_CHARS) {
        throw new ApiError(
            'No readable text found in the resume (scanned PDFs are not supported)',
            422,
            true,
            'NO_TEXT',
        );
    }
    return text;
}
