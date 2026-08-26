const activeAudios = new Set<HTMLAudioElement>();

// Global audio context for unlocking and fallback playback
let sharedAudioContext: AudioContext | null = null;
let isAudioUnlocked = false;

// Unlock audio on first user interaction to bypass browser autoplay restrictions
export function initAudioUnlock() {
    if (typeof window === 'undefined' || isAudioUnlocked) return;

    const unlock = async () => {
        try {
            if (!sharedAudioContext) {
                const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioCtx) {
                    sharedAudioContext = new AudioCtx();
                }
            }
            if (sharedAudioContext && sharedAudioContext.state === 'suspended') {
                await sharedAudioContext.resume();
            }
            isAudioUnlocked = true;
        } catch (err) {
            console.warn('AudioContext unlock failed:', err);
        } finally {
            window.removeEventListener('pointerdown', unlock);
            window.removeEventListener('keydown', unlock);
            window.removeEventListener('touchstart', unlock);
        }
    };

    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
}

// Auto-run unlock listener in browser
if (typeof window !== 'undefined') {
    initAudioUnlock();
}

export function normalizeAudioUrl(url: string | null | undefined): string {
    if (!url) return '/Sound effects/notification.mp3';
    if (url === '/notification.mp3') return '/Sound effects/notification.mp3';
    if (url.startsWith('/universfield-') && !url.includes('/Sound effects/') && !url.includes('/sounds/')) {
        return `/Sound effects${url}`;
    }
    if (url.startsWith('/dragon-studio-') && !url.includes('/Sound effects/') && !url.includes('/sounds/')) {
        return `/Sound effects${url}`;
    }
    return url;
}

export function resolveAudioUrl(rawUrl: string): string {
    if (!rawUrl) return '/Sound%20effects/notification.mp3';
    const trimmed = rawUrl.trim();

    // Check if it is an external URL (not current origin)
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        try {
            if (typeof window !== 'undefined') {
                const parsed = new URL(trimmed);
                if (parsed.origin === window.location.origin) {
                    return encodeURI(parsed.pathname + parsed.search);
                }
            }
            // Remote external URL: route through proxy to bypass CORS
            return `/api/audio-proxy?url=${encodeURIComponent(trimmed)}&_t=${Date.now()}`;
        } catch {
            return `/api/audio-proxy?url=${encodeURIComponent(trimmed)}&_t=${Date.now()}`;
        }
    }

    // Local static file: encode spaces and special characters for reliable web server fetching
    return encodeURI(trimmed);
}

function getFallbackAudioUrls(url: string): string[] {
    const clean = decodeURI(url);
    const filename = clean.split('/').pop() || '';
    if (!filename) return [];

    return [
        encodeURI(`/sounds/${filename}`),
        encodeURI(`/sound-effects/${filename}`),
        encodeURI(`/Sound effects/${filename}`),
        encodeURI(`/${filename}`)
    ].filter((u, index, self) => self.indexOf(u) === index && u !== encodeURI(url));
}

export async function playAudio(rawUrl: string, volume: number = 0.5, onEnded?: () => void) {
    try {
        const normalized = normalizeAudioUrl(rawUrl);
        const resolved = resolveAudioUrl(normalized);
        const fallbacks = getFallbackAudioUrls(normalized);

        const tryPlay = (targetUrl: string, remainingFallbacks: string[]): Promise<{ stop: () => void } | null> => {
            return new Promise((resolve) => {
                const audio = new Audio();
                audio.crossOrigin = 'anonymous';
                audio.src = targetUrl;
                audio.volume = Math.max(0, Math.min(1, volume));

                let hasEndedOrFailed = false;

                const cleanup = () => {
                    if (hasEndedOrFailed) return;
                    hasEndedOrFailed = true;
                    activeAudios.delete(audio);
                };

                audio.onended = () => {
                    cleanup();
                    if (onEnded) onEnded();
                };

                audio.onerror = () => {
                    cleanup();
                    if (remainingFallbacks.length > 0) {
                        const [nextUrl, ...rest] = remainingFallbacks;
                        resolve(tryPlay(nextUrl, rest));
                    } else {
                        console.warn(`All audio playback attempts failed for: ${rawUrl}`);
                        if (onEnded) onEnded();
                        resolve(null);
                    }
                };

                activeAudios.add(audio);

                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            resolve({
                                stop: () => {
                                    try {
                                        cleanup();
                                        audio.pause();
                                        audio.currentTime = 0;
                                    } catch {}
                                }
                            });
                        })
                        .catch((err) => {
                            // Autoplay was prevented or loading failed
                            if (err.name === 'NotAllowedError') {
                                console.warn('Audio playback prevented by browser autoplay policy. User interaction required.');
                                cleanup();
                                if (onEnded) onEnded();
                                resolve(null);
                            } else if (remainingFallbacks.length > 0) {
                                cleanup();
                                const [nextUrl, ...rest] = remainingFallbacks;
                                resolve(tryPlay(nextUrl, rest));
                            } else {
                                console.warn(`Audio play failed for ${targetUrl}:`, err);
                                cleanup();
                                if (onEnded) onEnded();
                                resolve(null);
                            }
                        });
                } else {
                    resolve({
                        stop: () => {
                            try {
                                cleanup();
                                audio.pause();
                                audio.currentTime = 0;
                            } catch {}
                        }
                    });
                }
            });
        };

        return await tryPlay(resolved, fallbacks);
    } catch (e: any) {
        console.error(`Failed to play audio for ${rawUrl}:`, e);
        if (onEnded) onEnded();
        return null;
    }
}

