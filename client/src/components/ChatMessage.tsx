import React, { useCallback, useState } from "react";
import ImageModal from "./ImageModal";

interface Attachment {
  url: string;
  name: string;
  mimeType: string;
}

interface ChatMsg {
  content: string;
  attachments?: Attachment[];
}

interface ChatMessageProps {
  message: ChatMsg;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const [modalImage, setModalImage] = useState<string | null>(null);

  const openImageModal = useCallback((url: string) => {
    setModalImage(url);
  }, []);

  const closeImageModal = () => {
    setModalImage(null);
  };

  const renderContent = () => {
    if (!message.attachments || message.attachments.length === 0) {
      return <p>{message.content}</p>;
    }

    return message.attachments.map((att, i) => {
      if (att.mimeType.startsWith("image/")) {
        return (
          <img
            key={i}
            src={att.url}
            alt={att.name}
            className="max-w-xs cursor-pointer rounded-md border border-border hover:ring-2 hover:ring-primary transition-all"
            onClick={() => openImageModal(att.url)}
          />
        );
      }
      return <p key={i}>{message.content}</p>;
    });
  };

  return (
    <>
      <div className="chat-message">{renderContent()}</div>
      {modalImage && <ImageModal imageUrl={modalImage} onClose={closeImageModal} />}
    </>
  );
};

export default ChatMessage;
