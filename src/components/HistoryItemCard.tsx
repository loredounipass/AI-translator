import React from "react";
import type { HistoryItem } from "../utils/historyService";

interface HistoryItemCardProps {
  item: HistoryItem;
  onRestore: (sourceText: string) => void;
  onEdit: (item: HistoryItem) => void;
  onToggleFavorite: (id: string, isFavorite: boolean) => void;
  onDelete: (id: string) => void;
}

const HistoryItemCard = React.memo(({
  item,
  onRestore,
  onEdit,
  onToggleFavorite,
  onDelete
}: HistoryItemCardProps) => {
  return (
    <div
      onClick={() => onRestore(item.source_text)}
      className={`relative bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-3 rounded-xl shadow-sm border ${item.is_favorite ? "border-yellow-400/40 dark:border-yellow-500/40" : "border-white/40 dark:border-slate-700/30"} text-left animate-fadeIn cursor-pointer hover:border-blue-400/60 dark:hover:border-blue-500/50 transition-colors group`}
    >
      <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(item);
          }}
          className="p-1 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-all"
          aria-label="Editar traducción"
          title="Editar traducción"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(item.id, item.is_favorite);
          }}
          className={`p-1 rounded transition-all ${item.is_favorite ? "text-yellow-400 dark:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20" : "text-slate-400 dark:text-slate-500 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"}`}
          aria-label="Favorito"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={item.is_favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
          className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
          aria-label="Eliminar traducción"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-1 pr-14 line-clamp-1 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors">{item.source_text}</p>
      <p className="text-sm text-slate-700 dark:text-slate-200 font-medium line-clamp-3 pr-10">{item.translated_text}</p>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.item.is_favorite === nextProps.item.is_favorite &&
    prevProps.item.source_text === nextProps.item.source_text &&
    prevProps.item.translated_text === nextProps.item.translated_text &&
    prevProps.item.id === nextProps.item.id
  );
});

export default HistoryItemCard;
