import { useCart } from '../hooks/useCart';

export default function TastingButton({ className = 'btn-outline' }: { className?: string }) {
  const { submit, status } = useCart();
  const loading = status.state === 'loading' && status.type === 'degustation';
  return (
    <button type="button" className={className} onClick={() => void submit('degustation')} disabled={loading}>
      {loading ? 'Envoi…' : 'Demander une dégustation gratuite'}
    </button>
  );
}
