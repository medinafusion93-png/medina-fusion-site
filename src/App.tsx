import BudgetSimulator from './components/BudgetSimulator';
import CartBar from './components/CartBar';
import CategoryNav from './components/CategoryNav';
import FaqSection from './components/FaqSection';
import Footer from './components/Footer';
import FormulesSection from './components/FormulesSection';
import Hero from './components/Hero';
import Highlights from './components/Highlights';
import OrderForm from './components/OrderForm';
import ProductSection from './components/ProductSection';
import StatusNotice from './components/StatusNotice';
import WhatsAppFab from './components/WhatsAppFab';
import { ASSETS } from './data/config';
import { CATEGORIES } from './data/products';

export default function App() {
  return (
    <>
      <a
        href="#carte"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-gold focus:px-4 focus:py-2 focus:text-ink"
      >
        Aller à la carte
      </a>

      <img
        src={ASSETS.banner}
        alt="Medina Fusion — Traiteur libano-tunisien"
        className="block h-auto w-full"
        onError={(e) => (e.currentTarget.style.display = 'none')}
      />

      <Hero />
      <Highlights />
      <CategoryNav />

      <main id="carte" className="mx-auto max-w-6xl scroll-mt-20 space-y-16 px-4 py-12 sm:px-6 lg:px-8">
        <BudgetSimulator />
        {CATEGORIES.map((cat) => (
          <ProductSection key={cat.id} category={cat} />
        ))}
        <FormulesSection />
        <OrderForm />
        <FaqSection />
      </main>

      <Footer />
      <CartBar />
      <WhatsAppFab />
      <StatusNotice />
    </>
  );
}
