import { useState } from 'react';

interface Props {
  src?: string;
  alt: string;
  className?: string;
  fallbackIcon?: string;
}

/** Image avec repli visuel si le fichier est absent */
export default function SafeImage({ src, alt, className = '', fallbackIcon = '🍽️' }: Props) {
  const [failed, setFailed] = useState(!src);
  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-gradient-to-br from-ink-600 to-ink-800 text-5xl ${className}`}
      >
        <span aria-hidden="true">{fallbackIcon}</span>
      </div>
    );
  }
  return <img src={src} alt={alt} loading="lazy" className={`object-cover ${className}`} onError={() => setFailed(true)} />;
}
