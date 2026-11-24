import { MotionConfig } from 'framer-motion';
import BudgetSimulator from './components/BudgetSimulator';
import CartBar from './components/CartBar';
import CategoryNav from './components/CategoryNav';
import FaqSection from './components/FaqSection';
import Footer from './components/Footer';
import FormulesSection from './components/FormulesSection';
import Hero from './components/Hero';
import Highlights from './components/Highlights';
import MenusFetesSection from './components/MenusFetesSection';
import NoelBar from './components/NoelBar';
import OfferBar from './components/OfferBar';
import OrderForm from './components/OrderForm';
import Reassurance from './components/Reassurance';
import ProductSection from './components/ProductSection';
import StatusNotice from './components/StatusNotice';
import WhatsAppFab from './components/WhatsAppFab';
import { CATEGORIES } from './data/products';

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <a
        href="#carte"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-gold focus:px-4 focus:py-2 focus:text-ink"
      >
        Aller à la carte
      </a>

      <NoelBar />
      <OfferBar />
      <Hero />
      <Highlights />
      <CategoryNav />

      <main id="carte" className="mx-auto max-w-6xl scroll-mt-20 space-y-16 px-4 py-12 sm:px-6 lg:px-8">
        <MenusFetesSection />
        <BudgetSimulator />
        {CATEGORIES.map((cat) => (
          <ProductSection key={cat.id} category={cat} />
        ))}
        <FormulesSection />
        <Reassurance />
        <OrderForm />
        <FaqSection />
      </main>

      <Footer />
      <CartBar />
      <WhatsAppFab />
      <StatusNotice />
    </MotionConfig>
  );
}
