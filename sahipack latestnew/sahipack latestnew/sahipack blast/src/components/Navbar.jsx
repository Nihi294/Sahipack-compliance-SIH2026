import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, X, Square } from "lucide-react";

const NAV_LINKS = [
  { label: "Product", id: "product" },
  { label: "How it works", id: "workflow" },
  { label: "Capabilities", id: "capabilities" },
  { label: "About", id: "trust" },
];

export default function Navbar() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const goToSection = (id) => {
    setOpen(false);
    if (location.pathname !== "/") {
      navigate("/");
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 60);
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-navy/95 backdrop-blur border-b border-white/10" : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-content mx-auto px-6 lg:px-10 flex items-center justify-between h-20">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3"
          aria-label="SahiPack home"
        >
          <span className="w-9 h-9 rounded-md bg-gold flex items-center justify-center">
            <Square className="w-4 h-4 text-navy" strokeWidth={2.5} />
          </span>
          <span className="flex flex-col leading-none text-left">
            <span className="font-display font-semibold text-cream text-lg tracking-tight">
              SahiPack
            </span>
            <span className="font-mono text-[10px] tracking-[0.16em] uppercase text-muted hidden sm:block">
              Legal Metrology Intelligence
            </span>
          </span>
        </button>

        <nav className="hidden lg:flex items-center gap-9">
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              onClick={() => goToSection(link.id)}
              className="text-sm text-cream/80 hover:text-gold transition-colors"
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="hidden lg:flex items-center gap-5">
          <button
  onClick={() => {
    const token = localStorage.getItem("sahipack_token");

    if (token) {
      navigate("/dashboard");
    } else {
      navigate("/login");
    }
  }}
  className="text-sm text-cream/80 hover:text-gold transition-colors"
>
  Inspector Login
</button>
          <button
            onClick={() => navigate("/inspection")}
            className="inline-flex items-center gap-1.5 bg-gold text-navy px-5 py-2.5 rounded-full font-semibold text-sm hover:bg-gold-dark transition-colors"
          >
            Get Started <span aria-hidden="true">→</span>
          </button>
        </div>

        <button
          className="lg:hidden text-cream"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-navy border-t border-white/10 px-6 py-6 flex flex-col gap-5">
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              onClick={() => goToSection(link.id)}
              className="text-left text-cream/90 text-base"
            >
              {link.label}
            </button>
          ))}
          <div className="h-px bg-white/10 my-1" />
          <button
  onClick={() => {
    const token = localStorage.getItem("sahipack_token");

    if (token) {
      navigate("/dashboard");
    } else {
      navigate("/login");
    }
  }}
  className="text-sm text-cream/80 hover:text-gold transition-colors"
>
  Inspector Login
</button>
          <button
            onClick={() => {
              setOpen(false);
              navigate("/inspection");
            }}
            className="bg-gold text-navy px-5 py-3 rounded-full font-semibold text-sm text-center"
          >
            Get Started →
          </button>
        </div>
      )}
    </header>
  );
}
