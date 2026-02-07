import { Link } from "react-router";
import { Header } from "~/components/layout/Header";
import { Footer } from "~/components/layout/Footer";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import {
  Search,
  Shield,
  BadgeCheck,
  Zap,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useSession } from "~/lib/auth-client";

// Brand Logo Components
const MarutiLogo = () => (
  <svg viewBox="0 0 1122.5 1122.5" className="w-12 h-12">
    {/* Official Suzuki S logo */}
    <path
      d="M1029.1,734.5c0,0-87.2,25.3-256.3,129.2C621,957,561.5,1019.7,561.5,1019.7L93.7,696.4c0,0,196.8-144.7,361.3-33.9l220.6,151.3l26.9-17.7L93.7,369.8c0,0,87.5-25.3,256.6-129.2C502.2,147.2,561.5,84.5,561.5,84.5l468,323.3c0,0-196.8,144.8-361.3,33.9L447.6,290.3L420.7,308L1029.1,734.5z"
      fill="#E31837"
    />
  </svg>
);

const HyundaiLogo = () => (
  <img src="/logos/hyundai.png" alt="Hyundai" className="w-12 h-12 object-contain" />
);

const TataLogo = () => (
  <img src="/logos/tata.png" alt="Tata" className="w-12 h-12 object-contain" />
);

const MahindraLogo = () => (
  <img src="/logos/mahindra.png" alt="Mahindra" className="w-12 h-12 object-contain" />
);

const ToyotaLogo = () => (
  <img src="/logos/toyota.png" alt="Toyota" className="w-12 h-12 object-contain" />
);

const HondaLogo = () => (
  <img src="/logos/honda.png" alt="Honda" className="w-12 h-12 object-contain" />
);

const KiaLogo = () => (
  <img src="/logos/kia.png" alt="Kia" className="w-12 h-12 object-contain" />
);

const MGLogo = () => (
  <img src="/logos/mg.png" alt="MG" className="w-12 h-12 object-contain" />
);

const POPULAR_BRANDS = [
  { name: "Maruti Suzuki", logo: <MarutiLogo /> },
  { name: "Hyundai", logo: <HyundaiLogo /> },
  { name: "Tata", logo: <TataLogo /> },
  { name: "Mahindra", logo: <MahindraLogo /> },
  { name: "Toyota", logo: <ToyotaLogo /> },
  { name: "Honda", logo: <HondaLogo /> },
  { name: "Kia", logo: <KiaLogo /> },
  { name: "MG", logo: <MGLogo /> },
];


import { HeroCarousel } from "~/components/home/HeroCarousel";
import { RevolvingCar } from "~/components/home/RevolvingCar";

const FEATURES = [
  {
    icon: Shield,
    title: "Quality Assured",
    description: "Every vehicle undergoes a rigorous 200-point inspection",
    color: "bg-blue-600",
    gradient: "from-blue-400 to-indigo-500",
    text: "text-blue-100",
    border: "group-hover:border-blue-500/50",
    shadow: "group-hover:shadow-blue-500/20"
  },
  {
    icon: BadgeCheck,
    title: "Verified Sellers",
    description: "All sellers are verified for your peace of mind",
    color: "bg-emerald-600",
    gradient: "from-emerald-400 to-teal-500",
    text: "text-emerald-100",
    border: "group-hover:border-emerald-500/50",
    shadow: "group-hover:shadow-emerald-500/20"
  },
  {
    icon: Zap,
    title: "Quick & Easy",
    description: "Buy or sell your vehicle in just a few clicks",
    color: "bg-purple-600",
    gradient: "from-purple-400 to-pink-500",
    text: "text-purple-100",
    border: "group-hover:border-purple-500/50",
    shadow: "group-hover:shadow-purple-500/20"
  },
];

export default function Home() {
  const [searchMake, setSearchMake] = useState("");
  const navigate = useNavigate();
  const { data: session } = useSession();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchMake) params.set("make", searchMake);
    navigate(`/vehicles?${params}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      <main className="flex-1">
        {/* Hero Section - Replaced with Carousel */}
        <HeroCarousel
          searchMake={searchMake}
          setSearchMake={setSearchMake}
          onSearch={handleSearch}
          popularBrands={POPULAR_BRANDS}
        />


        {/* Popular Brands */}
        <section className="py-20 relative">
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-3xl font-bold mb-3 text-slate-900">
                Popular Brands
              </h2>
              <p className="text-slate-500">
                Browse cars from top manufacturers
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-6">
              {POPULAR_BRANDS.map((brand) => (
                <Link
                  key={brand.name}
                  to={`/vehicles?make=${encodeURIComponent(brand.name)}`}
                  className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group"
                >
                  <div className="mb-4 w-12 h-12 flex items-center justify-center bg-slate-50 rounded-full p-2 group-hover:bg-blue-50 transition-colors duration-300">
                    <div className="w-full h-full flex items-center justify-center text-slate-700 group-hover:text-blue-600">
                      {brand.logo}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-center text-slate-600 group-hover:text-slate-900 transition-colors">
                    {brand.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>


        {/* Features */}
        <section className="py-24 relative overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0">
            <img
              src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1920&q=80"
              alt="Background"
              className="w-full h-full object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-slate-50/90 backdrop-blur-[2px]" />
          </div>

          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center mb-16">
              <Badge className="mb-4 bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100">
                Why Choose Us?
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900">
                Why Choose CarHub?
              </h2>
              <p className="text-slate-600 max-w-2xl mx-auto text-lg">
                The smarter way to buy and sell cars
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {FEATURES.map((feature, index) => (
                <Card
                  key={index}
                  className={`bg-white border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 group hover:-translate-y-1`}
                >
                  <CardContent className="p-8 text-center">
                    <div className={`w-20 h-20 mx-auto mb-6 rounded-3xl bg-blue-50 flex items-center justify-center shadow-sm transform group-hover:scale-110 transition-transform duration-500`}>
                      <feature.icon className="h-10 w-10 text-blue-600" />
                    </div>
                    <h3 className="font-bold text-xl mb-3 text-slate-900">
                      {feature.title}
                    </h3>
                    <p className={`text-sm leading-relaxed text-slate-600`}>
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>


        {/* CTA Section */}
        <section className="py-24 bg-slate-50 relative overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-blue-100/50 rounded-full blur-[120px] pointer-events-none" />

          <div className="container mx-auto px-4 relative z-10">
            <div className="max-w-6xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 md:p-12 shadow-xl overflow-hidden">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="text-left">
                  <h2 className="text-3xl md:text-5xl font-bold mb-6 text-slate-900">
                    Ready to Sell Your Car?
                  </h2>
                  <p className="text-lg md:text-xl text-slate-600 mb-8 font-light leading-relaxed">
                    Get the best price for your vehicle. Quick evaluation, transparent
                    process, and instant payment.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Button
                      asChild
                      size="lg"
                      className="font-semibold h-14 px-8 text-lg bg-blue-600 hover:bg-blue-700 text-white border-0 shadow-lg shadow-blue-600/20 transition-all hover:scale-105 group"
                    >
                      <Link to={session?.user ? "/seller/add-vehicle" : "/register?role=seller"}>
                        Start Selling
                        <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="h-14 px-8 text-lg border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all"
                    >
                      <Link to="/vehicles">Browse Cars</Link>
                    </Button>
                  </div>
                </div>

                <div className="h-[400px] w-full relative">
                  <RevolvingCar />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div >
  );
}
