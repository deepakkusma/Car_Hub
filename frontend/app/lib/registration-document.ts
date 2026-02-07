import { jsPDF } from "jspdf";
import type { Transaction } from "./api";
import { drawPdfSignature } from "./signature-utils";

interface RegistrationDocData {
    transaction: Transaction;
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}


export function generateRegistrationDocPDF(data: RegistrationDocData): void {
    const { transaction } = data;
    const doc = new jsPDF();

    // Get details from transaction
    let sellerName = transaction.seller?.name || "";
    const sellerNameLower = sellerName.toLowerCase();
    if (!sellerName || sellerNameLower === "admin" || sellerNameLower === "admin user" || sellerNameLower.includes("admin")) {
        sellerName = "Rohit Kumar";
    }
    const sellerPhone = transaction.seller?.phone || "";
    const buyerName = transaction.buyer?.name || "";
    const buyerEmail = transaction.buyer?.email || "";
    const buyerPhone = transaction.buyer?.phone || "";

    const vehicleMake = transaction.vehicle?.make || "";
    const vehicleModel = transaction.vehicle?.model || "";
    const vehicleYear = transaction.vehicle?.year?.toString() || "";
    const vehicleColor = transaction.vehicle?.color || "";
    const vehicleRegNo = transaction.vehicle?.registrationNumber || "PENDING";
    const vehicleTransmission = (transaction.vehicle as any)?.transmission || "Manual";
    const vehicleFuelType = (transaction.vehicle as any)?.fuelType || "Petrol";



    // ========== HEADER ==========
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("REGISTRATION CERTIFICATE FOR VEHICLE", 105, 15, { align: "center" });

    doc.setFontSize(10);
    doc.text("Issuing Authority : CARHUB AUTHORIZED, BADLAPUR MAHANAGAR PALIKA, BADLAPUR EAST", 105, 22, { align: "center" });

    doc.setFontSize(12);
    doc.text("Vehicle Bill of Sale", 105, 29, { align: "center" });

    // Bullet points instructions
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    let bullY = 36;
    const bullets = [
        "• Before purchasing a used vehicle, the buyer should verify its status on the Parivahan portal or local Police records to ensure it is",
        "  not reported stolen and may visit CarHub.com for additional buying tips and resources.",
        "• Sections 1 and 2 must be completed for this Bill of Sale to be valid for registration; two copies should be made (original for Buyer,",
        "  copy for Seller), and any corrections must be signed by both parties."
    ];
    bullets.forEach(line => {
        doc.text(line, 15, bullY);
        bullY += 4;
    });

    let currentY = 55;

    // ========== SECTION 1 ==========
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Section 1", 15, currentY);
    currentY += 4;

    const drawSectionHeader = (title: string, y: number) => {
        doc.setFillColor(230, 230, 230);
        doc.rect(15, y, 180, 6, "F");
        doc.setDrawColor(0);
        doc.setLineWidth(0.1);
        doc.rect(15, y, 180, 6);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(title, 105, y + 4.5, { align: "center" });
    };

    const drawFieldBox = (x: number, y: number, w: number, h: number, label: string, value: string = "") => {
        doc.rect(x, y, w, h);
        doc.setFontSize(6); // Smaller label
        doc.setFont("helvetica", "normal");
        doc.text(label, x + 2, y + 3); // Higher label position
        if (value) {
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text(value, x + 2, y + h - 2); // Lower value position
        }
    };

    const boxH = 10; // Increased back to 10 for breathing room
    const gap = 0; // Removed extra gap between rows, boxH handles it

    // SELLER INFORMATION
    drawSectionHeader("SELLER(S) INFORMATION", currentY);
    currentY += 6;
    drawFieldBox(15, currentY, 120, boxH, "Name(s) (Last, First, Second)", sellerName);
    drawFieldBox(135, currentY, 60, boxH, "Telephone Number", sellerPhone);
    currentY += boxH;
    drawFieldBox(15, currentY, 100, boxH, "Address", "Street");
    drawFieldBox(115, currentY, 35, boxH, "City / Town", "Badlapur");
    drawFieldBox(150, currentY, 25, boxH, "Province / State", "MH");
    drawFieldBox(175, currentY, 20, boxH, "Postal Code", "421503");
    currentY += boxH;
    drawFieldBox(15, currentY, 180, boxH, "Personal Identification (DL / ID Number)", "");
    currentY += boxH + 2; // Small gap before next section

    // VEHICLE INFORMATION
    drawSectionHeader("VEHICLE INFORMATION", currentY);
    currentY += 6;
    drawFieldBox(15, currentY, 30, boxH, "Fuel", vehicleFuelType);
    drawFieldBox(45, currentY, 20, boxH, "No of Cyl", "4");
    drawFieldBox(65, currentY, 90, boxH, "Model or Series", `${vehicleYear} ${vehicleMake} ${vehicleModel}`);
    drawFieldBox(155, currentY, 40, boxH, "Seating Capacity", "5");
    currentY += boxH;
    drawFieldBox(15, currentY, 100, boxH, "Engine Number", (transaction.vehicle as any)?.engineNumber || "");
    drawFieldBox(115, currentY, 35, boxH, "Body Colour", vehicleColor);
    drawFieldBox(150, currentY, 45, boxH, "Odometer Reading", (transaction.vehicle as any)?.mileage?.toString() || "");
    currentY += boxH + 2;

    // BUYER INFORMATION
    drawSectionHeader("BUYER(S) INFORMATION", currentY);
    currentY += 6;
    drawFieldBox(15, currentY, 120, boxH, "Name(s) (Last, First, Second)", buyerName);
    drawFieldBox(135, currentY, 60, boxH, "Telephone Number", buyerPhone);
    currentY += boxH;
    drawFieldBox(15, currentY, 100, boxH, "Address", "Street");
    drawFieldBox(115, currentY, 35, boxH, "City / Town", "");
    drawFieldBox(150, currentY, 25, boxH, "Province / State", "");
    drawFieldBox(175, currentY, 20, boxH, "Postal Code", "");
    currentY += boxH;
    drawFieldBox(15, currentY, 180, boxH, "Personal Identification (DL / ID Number)", "");
    currentY += boxH + 4;

    // SALE PRICE
    doc.rect(15, currentY, 180, 8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("This vehicle was sold for the sum of:", 17, currentY + 5.5);
    const amountText = transaction.amount ? `Rs. ${parseInt(transaction.amount).toLocaleString('en-IN')}/-` : "";
    doc.text(amountText, 150, currentY + 5.5, { align: "right" });
    doc.setFontSize(7);
    doc.text("Rupees", 193, currentY + 5.5, { align: "right" });

    currentY += 8; // Compressed gap
    doc.rect(15, currentY, 180, 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Sum written in full", 17, currentY + 5.5);

    currentY += 9;
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("(Subject to the terms and special conditions which appear in Section 3 on the back of this form)", 105, currentY, { align: "center" });

    currentY += 4; // Minimal gap

    // ========== SECTION 2 ==========
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Section 2", 15, currentY);
    currentY += 4;

    drawSectionHeader("GENERAL INFORMATION", currentY);
    currentY += 6;
    doc.rect(15, currentY, 180, 30); // Height 30

    // Dated at
    let innerY = currentY + 8;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Dated at:", 30, innerY);
    doc.line(45, innerY, 80, innerY); // City/Town
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("City / Town", 55, innerY + 3);

    doc.line(90, innerY, 130, innerY); // Province/State
    doc.text("Province / State", 100, innerY + 3);

    doc.line(140, innerY, 170, innerY); // Country
    doc.text("Country", 150, innerY + 3);

    innerY += 10;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("on:", 35, innerY);
    doc.text(formatDate(transaction.createdAt || new Date().toISOString()), 50, innerY);

    innerY += 8;
    doc.text("I certify that all information shown above is true to the best of my knowledge.", 30, innerY);

    currentY += 34; // Adjusted

    // Signatures
    const sigY = currentY;

    // Buyer Sig
    drawPdfSignature(doc, buyerName, 30, sigY + 5, 50);
    doc.setFontSize(7);
    doc.text("Signature of Buyer", 35, sigY + 14);

    // Seller Sig
    drawPdfSignature(doc, sellerName, 120, sigY + 5, 50);
    doc.setFontSize(7);
    doc.text("Signature of Seller", 125, sigY + 14);

    currentY += 25;

    // Witness
    doc.line(30, currentY + 8, 80, currentY + 8);
    doc.text("Signature of Buyer", 35, currentY + 11);

    doc.line(120, currentY + 8, 170, currentY + 8);
    doc.text("Signature of Witness", 125, currentY + 11);

    currentY += 15;
    doc.setFontSize(6);
    doc.text("CARHUB-FORM-01 Rev. 2026-01", 15, currentY);
    doc.text("Protected A (when completed)", 90, currentY);
    doc.text("Page 1 of 2", 180, currentY);

    // ========== PAGE 2 (Section 3) ==========
    doc.addPage();
    currentY = 20;

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Section 3", 15, currentY);
    currentY += 5;

    drawSectionHeader("SPECIAL CONDITIONS OF SALE", currentY);
    currentY += 10;

    doc.rect(15, currentY, 180, 75);

    let innerY2 = currentY + 10;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    // Helper to draw a checkmark or empty box
    const drawTick = (x: number, y: number, checked: boolean) => {
        // Draw brackets with extra space to fit the tick cleanly
        doc.text("(   )", x, y);
        if (checked) {
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.5);
            // Draw tick cleanly inside the brackets
            // Start stroke
            doc.line(x + 2.2, y - 0.8, x + 3.2, y + 0.2);
            // End stroke (longer)
            doc.line(x + 3.2, y + 0.2, x + 5.2, y - 2.8);
        }
    };

    doc.text("1. The vehicle described in this form is:", 20, innerY2);
    doc.text("Tick the appropriate box(es)", 20, innerY2 + 5);

    innerY2 += 12;
    doc.text("a) Free from any Loan / Legal Dues:", 20, innerY2);

    // Logic: Default Yes
    drawTick(80, innerY2, true); doc.text("Yes", 86, innerY2);
    drawTick(96, innerY2, false); doc.text("No", 102, innerY2);
    doc.text("If \"No\", provide name of Bank / Finance Company:", 112, innerY2);

    innerY2 += 12;
    doc.text("b) Full Payment Received:", 20, innerY2);

    // Logic: Default Yes for completed transactions
    drawTick(65, innerY2, true); doc.text("Yes", 71, innerY2);
    drawTick(81, innerY2, false); doc.text("No", 87, innerY2);

    innerY2 += 12;
    // Determines checks based on payment type
    const isCash = transaction.paymentType?.includes("cash") || transaction.paymentType === "split_cash";
    const isSplit = transaction.paymentType === "split_qr" || transaction.paymentType === "split_cash";
    const isCard = transaction.paymentType === "full_card" || transaction.paymentType === "advance_upi" || transaction.paymentType === "split_qr";

    doc.text("Being paid by:", 25, innerY2);
    drawTick(51, innerY2, isCash); doc.text("Cash", 57, innerY2);
    drawTick(71, innerY2, false); doc.text("Cheque", 77, innerY2);
    drawTick(96, innerY2, false); doc.text("Money Order", 102, innerY2);

    // Tick Other if card/upi
    drawTick(128, innerY2, isCard && !isCash); doc.text("Other (specify):", 134, innerY2);
    if (isCard && !isCash) {
        doc.text("Online/UPI", 160, innerY2);
    } else if (isSplit) {
        doc.text("Split (Cash+Online)", 160, innerY2);
    }

    innerY2 += 12;

    // Dynamic Payment Terms
    const totalAmount = parseFloat(transaction.amount || "0");
    const bookingAmount = parseFloat(transaction.bookingAmount || "0");
    const remainingAmount = parseFloat(transaction.remainingAmount || "0");

    let paymentTerms = "";

    if (bookingAmount > 0) {
        // Split payment case
        const paidBooking = bookingAmount.toLocaleString('en-IN');
        const paidBalance = remainingAmount.toLocaleString('en-IN');
        const paidTotal = (bookingAmount + remainingAmount).toLocaleString('en-IN');
        paymentTerms = `Booking: Rs. ${paidBooking} (Online) + Balance: Rs. ${paidBalance} (Cash/Online) = Total: Rs. ${paidTotal}`;

        // If remaining is 0, it means fully paid
        if (Math.abs((bookingAmount + remainingAmount) - totalAmount) < 1) {
            paymentTerms = `Paid Rs. ${paidBooking} (Booking) + Rs. ${paidBalance} (Final) = Total Rs. ${totalAmount.toLocaleString('en-IN')} (Full Clean)`;
        }
    } else {
        // Full payment case
        const method = (transaction.paymentType === 'full_card' || transaction.paymentType === 'advance_upi') ? 'Online/Card/UPI' : 'Cash';
        paymentTerms = `Full Payment of Rs. ${totalAmount.toLocaleString('en-IN')}/- received via ${method}.`;
    }

    doc.text("2. Payment Terms: ", 20, innerY2);
    doc.setFontSize(8); // slightly smaller for long text
    doc.text(paymentTerms, 50, innerY2);
    doc.line(50, innerY2 + 1, 190, innerY2 + 1); // underline extended
    doc.setFontSize(9);

    innerY2 += 12;
    doc.text("3. Vehicle was last registered in: ________________________________________________________________", 20, innerY2);
    doc.setFontSize(7);
    doc.text("Province / State                                                                  Country", 100, innerY2 + 3);

    currentY += 85;

    drawFieldBox(15, currentY, 180, 20, "4. Special conditions of sale (if any):", "");

    currentY += 35;

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("General Information:", 15, currentY);
    currentY += 8;
    doc.setFont("helvetica", "normal");
    const genInfo = [
        "• The Buyer must physically verify the Vehicle Identification Number (VIN/Chassis Number) and Engine Number on the vehicle",
        "  and ensure it matches the Registration Certificate (RC).",
        "• As per Indian Motor Vehicle Act, a vehicle must have valid insurance before it can be legally driven or transferred. Third-",
        "  party insurance is mandatory.",
        "• The Seller must provide original documents, including:",
        "  Registration Certificate (RC), Valid Insurance Certificate, Pollution Under Control (PUC) Certificate, Owner's ID Proof.",
        "• Form 29 and Form 30 must be signed by both Buyer and Seller for ownership transfer.",
        "• The Buyer must apply for ownership transfer at the local RTO (Regional Transport Office) within 14 days if within the",
        "  same state, or 45 days if interstate.",
        "• If the vehicle is transferred to another state, a No Objection Certificate (NOC) from the original RTO is required.",
        "• The Buyer should check whether the vehicle has any pending loans, hypothecation, or legal disputes before purchase. This",
        "  can be verified through the Parivahan portal or local RTO.",
        "• A Vehicle History / Information Report is recommended before purchase to confirm accident history, insurance claims, and",
        "  ownership records.",
        "• Road Tax must be cleared before transfer. In case of interstate transfer, new road tax may apply.",
        "• Commercial vehicles used for transport of goods or passengers require additional permits and fitness certificates.",
        "• Ensure PUC (Pollution Under Control) Certificate is valid at the time of transfer.",
        "• After transfer approval, the Buyer must obtain an updated RC in their name."
    ];

    genInfo.forEach(line => {
        doc.text(line, 15, currentY);
        currentY += 5;
    });

    currentY += 8;
    doc.setFontSize(6);
    doc.text("This form is provided by CarHub.com only as a convenience to include necessary details for vehicle sale and ownership transfer under applicable", 15, currentY);
    currentY += 3;
    doc.text("Indian laws, and CarHub.com assumes no liability for the accuracy of information or condition of the vehicle.", 15, currentY);

    currentY += 5;
    doc.text("Any dispute arising from the transaction shall be treated as a civil matter solely between the Buyer and Seller, and CarHub.com shall not be held", 15, currentY);
    currentY += 3;
    doc.text("responsible or involved in such disputes.", 15, currentY);

    currentY += 10;
    doc.text("CARHUB-FORM-01 Rev. 2026-01", 15, currentY);
    doc.text("Protected A (when completed)", 90, currentY);
    doc.text("Page 2 of 2", 180, currentY);

    // Save
    const fileName = `RC-${vehicleRegNo || "REG"}-${buyerName.replace(/\s/g, "_") || "Doc"}.pdf`;
    doc.save(fileName);
}

export function downloadRegistrationDoc(transaction: Transaction): void {
    generateRegistrationDocPDF({ transaction });
}
