import * as React from "react"
import { useNavigate } from "react-router"
import { Search } from "lucide-react"
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "~/components/ui/carousel"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select"
import { Button } from "~/components/ui/button"
import Autoplay from "embla-carousel-autoplay"

// Placeholder images for the carousel
const SLIDES = [
    {
        id: 1,
        image: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=2304&auto=format&fit=crop",
        title: "Find Your Perfect Ride",
        description: "Search, book, and buy verify cars from trusted sellers."
    },
    {
        id: 2,
        image: "https://images.unsplash.com/photo-1503376763036-066120622c74?q=80&w=2340&auto=format&fit=crop",
        title: "Start Your Journey",
        description: "Experience the thrill of the open road with our premium selection."
    },
    {
        id: 3,
        image: "https://images.unsplash.com/photo-1583121274602-3e2820c69888?q=80&w=2340&auto=format&fit=crop",
        title: "Quality You Can Trust",
        description: "Every vehicle is inspected and certified for your peace of mind."
    }
]

interface HeroCarouselProps {
    searchMake: string
    setSearchMake: (value: string) => void
    onSearch: (e: React.FormEvent) => void
    popularBrands?: { name: string; logo: React.ReactNode }[]
}

export function HeroCarousel({ searchMake, setSearchMake, onSearch, popularBrands }: HeroCarouselProps) {
    const plugin = React.useRef(
        Autoplay({ delay: 5000, stopOnInteraction: true })
    )

    // Use passed brands or default fallback
    const brands = popularBrands || [
        { name: "Maruti Suzuki", logo: null },
        { name: "Hyundai", logo: null },
        { name: "Tata", logo: null },
        { name: "Mahindra", logo: null },
        { name: "Toyota", logo: null },
        { name: "Honda", logo: null },
        { name: "Kia", logo: null },
        { name: "MG", logo: null },
    ];

    return (
        <div className="relative w-full h-[600px] overflow-hidden group">
            <Carousel
                plugins={[plugin.current]}
                className="w-full h-full"
                opts={{
                    loop: true,
                }}
            >
                <CarouselContent className="h-full">
                    {SLIDES.map((slide) => (
                        <CarouselItem key={slide.id} className="relative h-[600px] w-full">
                            {/* Background Image */}
                            <div
                                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
                                style={{ backgroundImage: `url(${slide.image})` }}
                            >
                                {/* Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0B0F19] via-[#0B0F19]/60 to-transparent" />
                                <div className="absolute inset-0 bg-black/30" />
                            </div>

                            {/* Content Overlay */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 z-10 pt-16">
                                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 drop-shadow-2xl tracking-tight">
                                    {slide.title}
                                </h1>
                                <p className="text-lg md:text-2xl text-slate-200 mb-10 max-w-2xl drop-shadow-lg font-light">
                                    {slide.description}
                                </p>

                                {/* Search Bar - only visible on first slide or consistent across all?
                    For UX, it's better to verify if the search bar should be always visible. 
                    I'll keep it as part of the overlay structure so it's always accessible. 
                */}
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                <CarouselPrevious className="left-4 bg-white/10 hover:bg-white/20 border-white/10 text-white hidden md:flex" />
                <CarouselNext className="right-4 bg-white/10 hover:bg-white/20 border-white/10 text-white hidden md:flex" />
            </Carousel>

            {/* Floating Search Bar (Positioned consistently over the carousel) */}
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-20">
                <div className="bg-white/95 backdrop-blur-sm border border-slate-200 p-4 rounded-2xl shadow-xl">
                    <form onSubmit={onSearch} className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <Select value={searchMake} onValueChange={setSearchMake}>
                                <SelectTrigger className="w-full h-12 bg-white border-slate-200 text-slate-900 placeholder:text-slate-500 focus:ring-blue-500/20">
                                    <SelectValue placeholder="Select Make" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-slate-200 text-slate-900">
                                    {brands.map((brand) => (
                                        <SelectItem key={brand.name} value={brand.name} className="focus:bg-slate-100 focus:text-slate-900 cursor-pointer">
                                            <div className="flex items-center gap-2">
                                                {brand.logo && <span className="w-4 h-4">{brand.logo}</span>}
                                                <span>{brand.name}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            type="submit"
                            size="lg"
                            className="h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 shadow-lg shadow-blue-600/20"
                        >
                            <Search className="mr-2 h-5 w-5" />
                            Search Cars
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    )
}
