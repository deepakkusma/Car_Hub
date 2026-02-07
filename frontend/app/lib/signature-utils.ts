import { jsPDF } from "jspdf";

/**
 * Generates the text to be used in the signature.
 * Uses the full name as requested.
 */
export function generateSignatureText(name: string): string {
    if (!name) return "";
    return name;
}

/**
 * Draws a stylish signature on the PDF document.
 * Simulates a handwritten look using offset characters and italic font.
 */
export function drawPdfSignature(doc: jsPDF, name: string, x: number, y: number, width: number = 50) {
    if (!name) {
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.1);
        doc.line(x, y + 8, x + width, y + 8);
        return;
    }

    const signatureText = generateSignatureText(name);
    doc.setFont("helvetica", "italic"); // Use italic to simulate cursive
    doc.setFontSize(16);
    doc.setTextColor(20, 20, 100); // Dark Blue ink color

    let currentX = x + 5;
    const startY = y + 5;

    // Draw each character with a slight vertical offset to simulate handwriting
    for (let i = 0; i < signatureText.length; i++) {
        const char = signatureText[i];
        // Create a sine wave effect
        const yOffset = Math.sin(i * 0.5) * 1.0;

        // Randomize slightly for more "organic" look
        const randomY = (Math.random() - 0.5) * 0.5;

        doc.text(char, currentX, startY + yOffset + randomY);
        currentX += doc.getTextWidth(char) + 0.2;
    }

    // Add a signature underline
    doc.setDrawColor(20, 20, 100);
    doc.setLineWidth(0.5);

    // Bezier curve underline for style
    // doc.lines([[width, 0, width/2, 2, width, 0]], x, y+8, [1,1]); 
    // keeping it simple line for robustness or a slight curve
    doc.line(x, y + 10, x + width, y + 10);

    // Reset styles
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setDrawColor(0, 0, 0);
}
