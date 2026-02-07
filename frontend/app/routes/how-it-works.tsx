import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Footer } from "~/components/layout/Footer";
import { useSession } from "~/lib/auth-client";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Card, CardContent } from "~/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Search, ClipboardCheck, Calendar, Truck, Car, CheckCircle2, DollarSign, Handshake } from "lucide-react";

export default function HowItWorks() {
    const { data: session } = useSession();
    const user = session?.user as any;
    const userRole = user?.role;
    const [activeTab, setActiveTab] = useState("buyer");

    useEffect(() => {
        if (userRole === "seller") setActiveTab("seller");
        else setActiveTab("buyer");
    }, [userRole]);

    const buyerSteps = [
        {
            icon: Search,
            title: "1. Browse Inventory",
            description: "Explore our wide range of quality verified cars. Filter by make, model, price, and more to find your perfect match."
        },
        {
            icon: ClipboardCheck,
            title: "2. View Inspection Report",
            description: "Every car comes with a detailed 200-point inspection report. Total transparency on the car's condition."
        },
        {
            icon: Calendar,
            title: "3. Book & Test Drive",
            description: "Reserve the car online with a fully refundable token amount and schedule a test drive at your convenience."
        },
        {
            icon: Truck,
            title: "4. Home Delivery",
            description: "Complete the paperwork and payment online. We'll deliver the car to your doorstep with a 7-day money-back guarantee."
        }
    ];

    const sellerSteps = [
        {
            icon: Car,
            title: "1. Enter Car Details",
            description: "Tell us about your car - make, model, year, and condition. Get an instant valuation estimate online."
        },
        {
            icon: CheckCircle2,
            title: "2. Free Inspection",
            description: "Schedule a free doorstep inspection. Our experts will verify the car's condition in just 30 minutes."
        },
        {
            icon: DollarSign,
            title: "3. Get Best Offer",
            description: "Based on the inspection, we give you a final best price offer. No haggling, no hidden fees."
        },
        {
            icon: Handshake,
            title: "4. Instant Payment",
            description: "Agree to the offer? We transfer the money instantly to your bank account and pick up the car."
        }
    ];

    const faqs = [
        {
            question: "Is the booking amount refundable?",
            answer: "Yes, the booking token is 100% fully refundable if you decide not to proceed with the purchase for any reason."
        },
        {
            question: "Do you offer financing options?",
            answer: "Absolutely! We partner with leading banks to offer competitive interest rates and instant loan approvals."
        },
        {
            question: "How long does the selling process take?",
            answer: "You can sell your car in as little as 24 hours. The inspection takes 30 minutes, and payment is instant upon agreement."
        },
        {
            question: "Are the cars covered by warranty?",
            answer: "Yes, every CarHub Certified car comes with a complimentary 12-month comprehensive warranty and roadside assistance."
        }
    ];

    return (
        <div className="min-h-screen flex flex-col bg-slate-50">
            <main className="flex-1">
                {/* Hero Section */}
                <div className="relative py-32 text-center overflow-hidden">
                    {/* Background Image with Overlay */}
                    <div className="absolute inset-0 z-0">
                        <img
                            src="https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1920&q=80"
                            alt="Car Background"
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-[2px]"></div>
                    </div>

                    <div className="container mx-auto px-4 relative z-10">
                        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">The Smarter Way to Buy & Sell</h1>
                        <p className="text-xl text-slate-300 max-w-2xl mx-auto">
                            Experience a seamless, transparent, and secure process designed for your peace of mind.
                        </p>
                    </div>
                </div>

                <div className="container mx-auto px-4 py-16 max-w-5xl">
                    {/* Steps Tabs */}
                    {userRole === "buyer" ? (
                        <div className="space-y-12">
                            <div className="text-center mb-10">
                                <h2 className="text-3xl font-bold text-slate-900">For Buyers</h2>
                                <p className="text-slate-500 mt-2">Your journey to finding the perfect car</p>
                            </div>
                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                                {buyerSteps.map((step, idx) => (
                                    <Card key={idx} className="border-none shadow-none bg-transparent text-center group">
                                        <CardContent className="p-0">
                                            <div className="w-16 h-16 mx-auto bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform">
                                                <step.icon size={32} />
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                                            <p className="text-slate-600 leading-relaxed">{step.description}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                            <div className="text-center">
                                <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6 h-auto" asChild>
                                    <Link to="/vehicles">Start Browsing Cars</Link>
                                </Button>
                            </div>
                        </div>
                    ) : userRole === "seller" ? (
                        <div className="space-y-12">
                            <div className="text-center mb-10">
                                <h2 className="text-3xl font-bold text-slate-900">For Sellers</h2>
                                <p className="text-slate-500 mt-2">Sell your car in 4 simple steps</p>
                            </div>
                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                                {sellerSteps.map((step, idx) => (
                                    <Card key={idx} className="border-none shadow-none bg-transparent text-center group">
                                        <CardContent className="p-0">
                                            <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform">
                                                <step.icon size={32} />
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                                            <p className="text-slate-600 leading-relaxed">{step.description}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                            <div className="text-center">
                                <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8 py-6 h-auto" asChild>
                                    <Link to="/register?role=seller">Sell Your Car</Link>
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Tabs defaultValue="buyer" value={activeTab} className="w-full" onValueChange={setActiveTab}>
                            <div className="flex justify-center mb-12">
                                <TabsList className="grid w-full max-w-md grid-cols-2 h-14 bg-white shadow-sm border border-slate-200">
                                    <TabsTrigger value="buyer" className="text-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white">For Buyers</TabsTrigger>
                                    <TabsTrigger value="seller" className="text-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white">For Sellers</TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent value="buyer" className="space-y-12">
                                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                                    {buyerSteps.map((step, idx) => (
                                        <Card key={idx} className="border-none shadow-none bg-transparent text-center group">
                                            <CardContent className="p-0">
                                                <div className="w-16 h-16 mx-auto bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform">
                                                    <step.icon size={32} />
                                                </div>
                                                <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                                                <p className="text-slate-600 leading-relaxed">{step.description}</p>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                                <div className="text-center">
                                    <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-6 h-auto" asChild>
                                        <Link to="/vehicles">Start Browsing Cars</Link>
                                    </Button>
                                </div>
                            </TabsContent>

                            <TabsContent value="seller" className="space-y-12">
                                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                                    {sellerSteps.map((step, idx) => (
                                        <Card key={idx} className="border-none shadow-none bg-transparent text-center group">
                                            <CardContent className="p-0">
                                                <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform">
                                                    <step.icon size={32} />
                                                </div>
                                                <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                                                <p className="text-slate-600 leading-relaxed">{step.description}</p>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                                <div className="text-center">
                                    <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-lg px-8 py-6 h-auto" asChild>
                                        <Link to="/register?role=seller">Sell Your Car</Link>
                                    </Button>
                                </div>
                            </TabsContent>
                        </Tabs>
                    )}

                    {/* FAQ Section */}
                    <div className="mt-24 max-w-3xl mx-auto">
                        <h2 className="text-3xl font-bold text-center text-slate-900 mb-10">Frequently Asked Questions</h2>
                        <Accordion type="single" collapsible className="w-full space-y-4">
                            {faqs.map((faq, idx) => (
                                <AccordionItem key={idx} value={`item-${idx}`} className="bg-white border border-slate-200 rounded-lg px-4 shadow-sm">
                                    <AccordionTrigger className="text-lg font-medium text-slate-900 hover:no-underline">{faq.question}</AccordionTrigger>
                                    <AccordionContent className="text-slate-600 text-base leading-relaxed pb-4">
                                        {faq.answer}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
