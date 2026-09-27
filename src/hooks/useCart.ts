import { useContext } from 'react';
import { OrderContext, type OrderContextValue } from '../context/OrderProvider';

/** Accès au panier, au formulaire client et à l’envoi de commande */
export function useCart(): OrderContextValue {
  const ctx = useContext(OrderContext);
  if (!ctx) throw new Error('useCart doit être utilisé dans <OrderProvider>');
  return ctx;
}
