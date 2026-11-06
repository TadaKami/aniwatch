import { useState, type ImgHTMLAttributes, type SyntheticEvent } from 'react';

const FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400">' +
    '<rect width="300" height="400" fill="#1a1a20"/>' +
    '<text x="150" y="200" fill="#8e8e93" font-family="sans-serif" font-size="16" text-anchor="middle">Нет постера</text></svg>'
);

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src?: string | null };

/** Displays a consistent placeholder when a remote poster is missing or temporarily unavailable. */
export function CoverImage({ src, onError, ...props }: Props) {
    const [failedSrc, setFailedSrc] = useState<string | null>(null);
    const visibleSrc = src && failedSrc !== src ? src : FALLBACK;

    function handleError(event: SyntheticEvent<HTMLImageElement>) {
        if (src) setFailedSrc(src);
        onError?.(event);
    }

    return <img {...props} src={visibleSrc} onError={handleError} />;
}
