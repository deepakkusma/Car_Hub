import { jsPDF } from "jspdf";
import type { Transaction } from "./api";
import { drawPdfSignature } from "./signature-utils";

interface InvoiceData {
    transaction: Transaction;
    companyInfo?: {
        name: string;
        address: string;
        phone: string;
        email: string;
        gstin?: string;
    };
}

const DEFAULT_COMPANY_INFO = {
    name: "CarHub",
    address: "123 Auto Street, Mumbai, Maharashtra 400001",
    phone: "+91 1800-123-4567",
    email: "support@carhub.com",
    gstin: "27AABCC1234D1ZM",
};

function formatCurrency(amount: string | number): string {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return "Rs. " + num.toLocaleString("en-IN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}

function drawAmountSummaryBox(params: {
    doc: jsPDF;
    x: number;
    y: number;
    w: number;
    rowH: number;
    labels: string[];
    values: string[];
}): number {
    const { doc, x, y, w, rowH, labels, values } = params;
    const rows = Math.min(labels.length, values.length);
    const h = rows * rowH;

    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.2);
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, w, h, "FD");

    for (let i = 1; i < rows; i++) {
        doc.line(x, y + rowH * i, x + w, y + rowH * i);
    }

    const labelX = x + 6;
    const valueX = x + w - 6;

    doc.setFontSize(9);
    for (let i = 0; i < rows; i++) {
        const cy = y + rowH * i + rowH / 2 + 3;

        doc.setTextColor(75, 85, 99);
        doc.setFont("helvetica", "bold");
        doc.text(labels[i], labelX, cy);

        // Only draw value if it's not empty string (allows manual override later)
        if (values[i]) {
            doc.setTextColor(17, 24, 39);
            doc.setFont("helvetica", i === 0 ? "bold" : "normal");
            doc.text(values[i], valueX, cy, { align: "right" });
        }
    }

    return y + h;
}

export function generateInvoicePDF(data: InvoiceData): void {
    const { transaction, companyInfo = DEFAULT_COMPANY_INFO } = data;
    const doc = new jsPDF();

    // Theme (match a clean, classic invoice style like the reference image)
    const primaryColor = [17, 24, 39] as const; // near-black
    const grayColor = [107, 114, 128] as const; // muted gray
    const darkColor = [17, 24, 39] as const;
    const lineColor = [209, 213, 219] as const;

    let yPos = 20;

    // Header (no blue banner; clean black/gray typography)
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text(companyInfo.name, 20, 22);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.text(companyInfo.address, 20, 30);
    doc.text(`Phone: ${companyInfo.phone}`, 20, 36);
    if (companyInfo.gstin) doc.text(`GSTIN: ${companyInfo.gstin}`, 20, 42);

    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.text("INVOICE", 190, 22, { align: "right" });

    // Header divider
    doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
    doc.setLineWidth(0.3);
    doc.line(20, 48, 190, 48);

    yPos = 58;

    // Invoice Info Box
    doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
    doc.setLineWidth(0.2);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(120, yPos, 70, 36, 2, 2, "FD");

    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Invoice No.", 125, yPos + 10);
    doc.text("Invoice Date", 125, yPos + 22);
    doc.text("Status", 125, yPos + 34);

    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont("helvetica", "normal");
    doc.text(`INV-${transaction.id.slice(0, 8).toUpperCase()}`, 188, yPos + 10, { align: "right" });
    doc.text(formatDate(transaction.createdAt), 188, yPos + 22, { align: "right" });

    // Status with color
    const statusText =
        transaction.status === "payment_completed" || transaction.status === "completed"
            ? "PAID"
            : transaction.status === "pending" || transaction.status === "payment_initiated"
                ? "PENDING"
                : transaction.status.toUpperCase().replace(/_/g, " ");
    const statusColor =
        statusText === "PAID"
            ? [22, 163, 74]
            : statusText === "PENDING"
                ? [234, 179, 8]
                : [239, 68, 68];
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text(statusText, 188, yPos + 34, { align: "right" });

    yPos = 110;

    // Buyer Information
    doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
    doc.line(20, yPos - 5, 190, yPos - 5);

    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Billed To:", 20, yPos + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(transaction.buyer?.name || "N/A", 20, yPos + 15);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.setFontSize(9);
    doc.text(transaction.buyer?.email || "N/A", 20, yPos + 22);
    if (transaction.buyer?.phone) {
        doc.text(`Phone: ${transaction.buyer.phone}`, 20, yPos + 29);
    }

    // Seller Information
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Seller:", 120, yPos + 5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(transaction.seller?.name || "N/A", 120, yPos + 15);
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.setFontSize(9);
    if (transaction.seller?.phone) {
        doc.text(`Phone: ${transaction.seller.phone}`, 120, yPos + 22);
    }

    yPos = 155;

    // Vehicle Details Table Header (classic light header)
    doc.setDrawColor(lineColor[0], lineColor[1], lineColor[2]);
    doc.setLineWidth(0.2);
    doc.setFillColor(249, 250, 251);
    doc.rect(20, yPos, 170, 12, "FD");

    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Vehicle Details", 25, yPos + 8);
    doc.text("Amount", 185, yPos + 8, { align: "right" });

    yPos += 12;

    // Vehicle Details Row
    doc.setFillColor(255, 255, 255);
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);

    const vehicleName = transaction.vehicle
        ? `${transaction.vehicle.year} ${transaction.vehicle.make} ${transaction.vehicle.model}`
        : "Vehicle";

    doc.text(vehicleName, 25, yPos + 10);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.setFontSize(9);

    let detailY = yPos + 18;
    if (transaction.vehicle?.registrationNumber) {
        doc.text(`Registration: ${transaction.vehicle.registrationNumber}`, 25, detailY);
        detailY += 6;
    }

    // Payment type info
    if (transaction.paymentType) {
        const paymentTypeLabels: Record<string, string> = {
            full_card: "Full Payment (Card)",
            advance_upi: "Advance Payment (UPI)",
            cash_booking: "Cash Booking",
            split_qr: "Split Payment (QR + Card)",
            split_cash: "Split Payment (Cash + Card)",
        };
        doc.text(`Payment Method: ${paymentTypeLabels[transaction.paymentType] || transaction.paymentType}`, 25, detailY);
        detailY += 6;
    }

    if (transaction.razorpayPaymentId) {
        doc.text(`Transaction ID: ${transaction.razorpayPaymentId}`, 25, detailY);
    }

    // Amount on right
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(formatCurrency(transaction.amount), 165, yPos + 10);

    yPos = detailY + 15;

    // Divider
    doc.setDrawColor(229, 231, 235);
    doc.line(20, yPos, 190, yPos);

    yPos += 10;

    // Breakdown section (if split payment)
    if (transaction.bookingAmount && transaction.remainingAmount && transaction.paymentType !== "full_card") {
        // Match a more "invoice-like" summary (as per reference): TOTAL / LESS DEPOSIT RECEIVED / TOTAL DUE
        const boxX = 120;
        const boxW = 70;
        const boxY = yPos;
        const rowH = 10;

        const total = formatCurrency(transaction.amount);
        const deposit = formatCurrency(transaction.bookingAmount);
        const due = formatCurrency(transaction.remainingAmount);

        const endY = drawAmountSummaryBox({
            doc,
            x: boxX,
            y: boxY,
            w: boxW,
            rowH,
            labels: ["TOTAL", "LESS DEPOSIT RECEIVED", "TOTAL DUE"],
            values: [total, deposit, ""], // Avoid double print for 'due'
        });

        // emphasize TOTAL DUE slightly
        doc.setTextColor(17, 24, 39);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(due, boxX + boxW - 6, boxY + rowH * 2 + rowH / 2 + 3, { align: "right" });

        yPos = endY + 12;
    } else {
        // Simple total
        doc.setFillColor(249, 250, 251);
        doc.rect(100, yPos - 5, 90, 25, "F");

        doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Total Amount:", 105, yPos + 10);

        doc.setTextColor(22, 163, 74);
        doc.setFontSize(14);
        doc.text(formatCurrency(transaction.amount), 155, yPos + 10);

        yPos += 35;
    }

    // Terms and Notes
    yPos = Math.max(yPos, 220);
    doc.setDrawColor(229, 231, 235);
    doc.line(20, yPos, 190, yPos);

    yPos += 10;

    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Terms & Conditions:", 20, yPos);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    yPos += 8;
    doc.text("1. Vehicle ownership transfer is subject to completion of all legal formalities.", 20, yPos);
    yPos += 5;
    doc.text("2. All disputes are subject to Mumbai jurisdiction.", 20, yPos);

    // Authorized Signatory
    const signerName = transaction.seller?.name || companyInfo.name;
    // Position at bottom right
    const sigY = yPos + 10;
    doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text("Authorized Signatory", 150, sigY);

    drawPdfSignature(doc, signerName, 140, sigY + 5, 50);

    // Footer
    yPos = 280;
    doc.setFillColor(249, 250, 251);
    doc.rect(0, yPos - 5, 220, 20, "F");

    doc.setTextColor(grayColor[0], grayColor[1], grayColor[2]);
    doc.setFontSize(8);
    doc.text("Thank you for choosing CarHub! For any queries, contact us at support@carhub.com", 105, yPos + 3, { align: "center" });
    doc.text(`Generated on ${new Date().toLocaleString("en-IN")}`, 105, yPos + 9, { align: "center" });

    // Save the PDF
    const fileName = `Invoice-${transaction.id.slice(0, 8).toUpperCase()}-${transaction.vehicle?.make || "Vehicle"}.pdf`;
    doc.save(fileName);
}

export function downloadInvoice(transaction: Transaction): void {
    generateInvoicePDF({ transaction });
}
