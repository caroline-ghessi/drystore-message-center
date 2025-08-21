import { cn } from "@/lib/utils";
import { Play, Pause, Download, FileText, MapPin, Loader2, AlertTriangle, Volume2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect } from "react";

export type MessageType = 'text' | 'audio' | 'image' | 'video' | 'document' | 'location' | 'voice';
export type SenderType = 'customer' | 'bot' | 'seller' | 'system';

interface MessageBubbleProps {
  content: string;
  sender_type: SenderType;
  sender_name: string;
  message_type: MessageType;
  media_url?: string;
  created_at: string;
  metadata?: any;
  className?: string;
}

export function MessageBubble({
  content,
  sender_type,
  sender_name,
  message_type,
  media_url,
  created_at,
  metadata,
  className
}: MessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();
  
  const isFromCustomer = sender_type === 'customer';
  const isFromBot = sender_type === 'bot';
  const isFromSeller = sender_type === 'seller';
  const isSystem = sender_type === 'system';

  // Check if media is being processed or failed
  const isMediaProcessing = media_url && !media_url.startsWith('http') && !metadata?.processing_failed;
  const mediaProcessingFailed = metadata?.processing_failed;
  const isValidMediaUrl = media_url && media_url.startsWith('http');

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // Extrair nome do arquivo do content ou metadata
  const extractFileName = (content: string, metadata?: any): string => {
    // Tentar extrair do content no formato "[Documento: filename.pdf]"
    const documentMatch = content.match(/\[Documento: (.+?)\]/);
    if (documentMatch && documentMatch[1]) {
      return documentMatch[1];
    }
    
    // Fallback para metadata ou content direto ou nome padrão
    return metadata?.file_name || content || 'Documento';
  };

  const handleDownload = async (url: string, filename: string) => {
    setIsDownloading(true);
    
    try {
      // Tentar baixar via fetch + blob para contornar CORS
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Limpar o blob URL depois de um tempo
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      
      toast({
        title: "Download concluído",
        description: `${filename} foi baixado com sucesso.`,
      });
      
    } catch (error) {
      console.error('Erro no download:', error);
      
      toast({
        title: "Erro no download",
        description: "Tentando abrir arquivo em nova aba...",
        variant: "destructive",
      });
      
      // Fallback: tentar abrir em nova aba
      try {
        window.open(url, '_blank');
      } catch (fallbackError) {
        toast({
          title: "Erro",
          description: "Não foi possível baixar ou abrir o arquivo.",
          variant: "destructive",
        });
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleView = async (url: string, filename: string) => {
    setIsViewing(true);
    
    try {
      // Abrir em nova aba para visualização
      window.open(url, '_blank');
      
      toast({
        title: "Arquivo aberto",
        description: `${filename} foi aberto em nova aba.`,
      });
    } catch (error) {
      console.error('Erro ao abrir arquivo:', error);
      
      toast({
        title: "Erro",
        description: "Não foi possível abrir o arquivo.",
        variant: "destructive",
      });
    } finally {
      setIsViewing(false);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const renderMediaProcessingState = () => (
    <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Processando mídia...</span>
    </div>
  );

  const renderMediaFailedState = () => (
    <div className="flex items-center space-x-2 p-3 bg-destructive/10 rounded-lg">
      <AlertTriangle className="h-4 w-4 text-destructive" />
      <span className="text-sm text-destructive">Erro ao carregar mídia</span>
    </div>
  );

  const renderMessageContent = () => {
    switch (message_type) {
      case 'audio':
      case 'voice':
        if (isMediaProcessing) return renderMediaProcessingState();
        if (mediaProcessingFailed) return renderMediaFailedState();
        
        return (
          <div className="flex items-center space-x-3 p-2 min-w-[200px]">
            {isValidMediaUrl && (
              <audio ref={audioRef} src={media_url} preload="metadata" />
            )}
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-8 w-8 p-0"
              onClick={handlePlayPause}
              disabled={!isValidMediaUrl}
            >
              {message_type === 'voice' ? (
                <Volume2 className="h-4 w-4" />
              ) : isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <div className="flex-1">
              <div className="h-1 bg-muted rounded-full">
                <div 
                  className="h-1 bg-primary rounded-full transition-all duration-150"
                  style={{ 
                    width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' 
                  }}
                />
              </div>
            </div>
            <span className="text-xs text-muted-foreground min-w-[35px] text-right">
              {duration > 0 ? formatDuration(currentTime) : '0:00'}
            </span>
          </div>
        );
      
      case 'image':
        if (isMediaProcessing) return renderMediaProcessingState();
        if (mediaProcessingFailed) return renderMediaFailedState();
        
        return (
          <div className="max-w-xs">
            {isValidMediaUrl ? (
              <div className="relative">
                {!imageLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                <img 
                  src={media_url} 
                  alt="Imagem compartilhada"
                  className={cn(
                    "rounded-lg w-full h-auto transition-opacity duration-200",
                    imageLoaded ? "opacity-100" : "opacity-0"
                  )}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                />
                {imageError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-muted rounded-lg aspect-square flex items-center justify-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            {content && <p className="mt-2 text-sm">{content}</p>}
          </div>
        );
      
      case 'video':
        if (isMediaProcessing) return renderMediaProcessingState();
        if (mediaProcessingFailed) return renderMediaFailedState();
        
        return (
          <div className="max-w-xs">
            {isValidMediaUrl ? (
              <video 
                controls 
                className="rounded-lg w-full h-auto"
                preload="metadata"
              >
                <source src={media_url} />
                Seu navegador não suporta reprodução de vídeo.
              </video>
            ) : (
              <div className="relative bg-muted rounded-lg aspect-video flex items-center justify-center">
                <Play className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            {content && <p className="mt-2 text-sm">{content}</p>}
          </div>
        );
      
      case 'document':
        if (isMediaProcessing) return renderMediaProcessingState();
        if (mediaProcessingFailed) return renderMediaFailedState();
        
        const fileName = extractFileName(content, metadata);
        const fileSize = metadata?.file_size ? `${Math.round(metadata.file_size / 1024)} KB` : '';
        const mimeType = metadata?.mime_type || '';
        const isPDF = mimeType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');
        
        return (
          <div className="flex items-center space-x-3 p-3 bg-muted rounded-lg max-w-xs">
            <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fileName}</p>
              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                {mimeType && <span>{mimeType.split('/')[1]?.toUpperCase()}</span>}
                {fileSize && <span>• {fileSize}</span>}
              </div>
            </div>
            {isValidMediaUrl && (
              <div className="flex space-x-1 flex-shrink-0">
                {/* Botão Visualizar */}
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0"
                  onClick={() => handleView(media_url!, fileName)}
                  disabled={isViewing}
                  title="Visualizar arquivo"
                >
                  {isViewing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
                
                {/* Botão Baixar */}
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0"
                  onClick={() => handleDownload(media_url!, fileName)}
                  disabled={isDownloading}
                  title="Baixar arquivo"
                >
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>
        );
      
      case 'location':
        // Parse location from content if available
        const locationMatch = content.match(/\[Localização: (-?\d+\.?\d*), (-?\d+\.?\d*)\]/);
        const lat = locationMatch?.[1];
        const lng = locationMatch?.[2];
        const googleMapsUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null;
        
        return (
          <div className="max-w-xs">
            <div 
              className={cn(
                "bg-muted rounded-lg p-4 flex items-center space-x-3",
                googleMapsUrl && "cursor-pointer hover:bg-muted/80 transition-colors"
              )}
              onClick={() => googleMapsUrl && window.open(googleMapsUrl, '_blank')}
            >
              <MapPin className="h-6 w-6 text-muted-foreground flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Localização compartilhada</p>
                <p className="text-xs text-muted-foreground">
                  {googleMapsUrl ? 'Toque para abrir no Google Maps' : 'Localização indisponível'}
                </p>
              </div>
            </div>
            {lat && lng && (
              <div className="mt-2 text-xs text-muted-foreground font-mono">
                {lat}, {lng}
              </div>
            )}
          </div>
        );
      
      default:
        return <p className="text-sm leading-relaxed">{content}</p>;
    }
  };

  if (isSystem) {
    return (
      <div className={cn("flex justify-center my-4", className)}>
        <div className="bg-muted px-4 py-2 rounded-full">
          <p className="text-xs text-muted-foreground text-center">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex mb-4 animate-fade-in",
      isFromCustomer ? "justify-end" : "justify-start",
      className
    )}>
      <div className={cn(
        "max-w-[70%] rounded-2xl px-4 py-3",
        isFromCustomer && "bg-drystore-orange text-white",
        isFromBot && "bg-muted",
        isFromSeller && "bg-drystore-info text-white"
      )}>
        {/* Sender name for non-customer messages */}
        {!isFromCustomer && (
          <div className="flex items-center justify-between mb-1">
            <p className={cn(
              "text-xs font-medium",
              isFromBot && "text-drystore-orange",
              isFromSeller && "text-drystore-info"
            )}>
              {sender_name}
            </p>
          </div>
        )}
        
        {/* Message content */}
        <div className={cn(
          isFromCustomer ? "text-white" : "",
          isFromBot ? "text-foreground" : "",
          isFromSeller ? "text-white" : ""
        )}>
          {renderMessageContent()}
        </div>
        
        {/* Timestamp */}
        <div className="flex justify-end mt-1">
          <span className={cn(
            "text-xs",
            isFromCustomer ? "text-white/70" : "text-muted-foreground"
          )}>
            {formatTime(created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}