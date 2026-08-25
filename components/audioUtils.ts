const activeAudios = new Set<HTMLAudioElement>();

export async function playAudio(url: string, volume: number = 0.5, onEnded?: () => void) {
    try {
        const audio = new Audio(url);
        audio.volume = volume;
        
        audio.onended = () => {
            activeAudios.delete(audio);
            if (onEnded) onEnded();
        };
        
        audio.onerror = (e) => {
            console.error(`Audio element error for ${url}:`, audio.error);
            activeAudios.delete(audio);
            if (onEnded) onEnded();
        };
        
        activeAudios.add(audio);
        const playPromise = audio.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(e => {
                console.error(`Audio playback failed for ${url}:`, e);
                activeAudios.delete(audio);
                if (onEnded) onEnded();
            });
        }
        
        return {
            stop: () => {
                try {
                    audio.pause();
                    audio.currentTime = 0;
                    activeAudios.delete(audio);
                } catch (e) {}
            }
        };
    } catch (e: any) {
        console.error(`Failed to initialize audio for ${url}:`, e);
        if (onEnded) onEnded();
        return null;
    }
}
