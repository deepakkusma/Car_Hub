import { Link } from "react-router";
import { Car, Facebook, Twitter, Instagram, Youtube, Mail, Phone, MapPin } from "lucide-react";
import { useSession } from "~/lib/auth-client";

export function Footer() {
    const { data: session } = useSession();
    return (
        <footer className="bg-white text-slate-600 border-t border-slate-200 relative z-10">
            <div className="container mx-auto px-4 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {/* Brand */}
                    <div className="space-y-4">
                        <Link to="/" className="flex items-center gap-3">
                            <img src="/logo.png" alt="CarHub Logo" className="h-10 w-auto object-contain" />
                            <span className="font-bold text-2xl tracking-tight text-slate-900">CarHub</span>
                        </Link>
                        <p className="text-sm leading-relaxed">
                            Your trusted platform for buying and selling quality pre-owned vehicles.
                            Find your dream car or sell your vehicle with confidence.
                        </p>
                        <div className="flex gap-4">
                            <a href="#" className="text-slate-400 hover:text-blue-600 transition-colors">
                                <Facebook className="h-5 w-5" />
                            </a>
                            <a href="#" className="text-slate-400 hover:text-blue-600 transition-colors">
                                <Twitter className="h-5 w-5" />
                            </a>
                            <a href="#" className="text-slate-400 hover:text-blue-600 transition-colors">
                                <Instagram className="h-5 w-5" />
                            </a>
                            <a href="#" className="text-slate-400 hover:text-blue-600 transition-colors">
                                <Youtube className="h-5 w-5" />
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="font-bold text-slate-900 mb-6">Quick Links</h3>
                        <ul className="space-y-3 text-sm">
                            <li>
                                <Link to="/vehicles" className="hover:text-blue-600 transition-colors">
                                    Browse Cars
                                </Link>
                            </li>
                            {(session?.user as any)?.role !== "admin" && (
                                <li>
                                    <Link to={session?.user ? "/seller/add-vehicle" : "/register?role=seller"} className="hover:text-blue-400 transition-colors">
                                        Sell Your Car
                                    </Link>
                                </li>
                            )}
                            <li>
                                <Link to="/about" className="hover:text-blue-400 transition-colors">
                                    About Us
                                </Link>
                            </li>
                            <li>
                                <Link to="/contact" className="hover:text-blue-400 transition-colors">
                                    Contact
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Popular Brands */}
                    <div>
                        <h3 className="font-bold text-slate-900 mb-6">Popular Brands</h3>
                        <ul className="space-y-3 text-sm">
                            <li>
                                <Link to="/vehicles?make=Toyota" className="hover:text-blue-600 transition-colors">
                                    Toyota
                                </Link>
                            </li>
                            <li>
                                <Link to="/vehicles?make=Honda" className="hover:text-blue-600 transition-colors">
                                    Honda
                                </Link>
                            </li>
                            <li>
                                <Link to="/vehicles?make=Hyundai" className="hover:text-blue-600 transition-colors">
                                    Hyundai
                                </Link>
                            </li>
                            <li>
                                <Link to="/vehicles?make=Maruti Suzuki" className="hover:text-blue-600 transition-colors">
                                    Maruti Suzuki
                                </Link>
                            </li>
                            <li>
                                <Link to="/vehicles?make=Tata" className="hover:text-blue-600 transition-colors">
                                    Tata
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h3 className="font-bold text-slate-900 mb-6">Contact Us</h3>
                        <ul className="space-y-4 text-sm">
                            <li className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                                    <MapPin className="h-4 w-4 text-blue-600" />
                                </div>
                                <span>123 Auto Street, Car City, 12345</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                                    <Phone className="h-4 w-4 text-blue-600" />
                                </div>
                                <span>+91 98765 43210</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                                    <Mail className="h-4 w-4 text-blue-600" />
                                </div>
                                <span>support@carhub.com</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-slate-200 mt-12 pt-8 text-center text-sm text-slate-500">
                    <p>&copy; {new Date().getFullYear()} CarHub. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
}
