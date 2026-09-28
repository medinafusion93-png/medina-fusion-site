import { CONTACT } from '../data/config';
import { useCart } from '../hooks/useCart';

/** Bouton WhatsApp flottant (masqué quand la barre panier est visible, qui a déjà son bouton WhatsApp) */
export default function WhatsAppFab() {
  const { count } = useCart();
  if (count > 0) return null;
  const text = encodeURIComponent('Bonjour Medina Fusion, je souhaite des informations pour une commande traiteur.');
  return (
    <a
      href={`https://wa.me/${CONTACT.whatsappIntl}?text=${text}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Nous écrire sur WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#1f9d55] text-2xl text-white shadow-xl shadow-black/50 transition hover:scale-105 hover:bg-[#1b8a4a] sm:bottom-6 sm:right-6"
    >
      <span aria-hidden="true">💬</span>
    </a>
  );
}
