'use client';

export interface TagBadgesProps {
  tags: string[] | null;
  onTagClick?: (tag: string) => void;
  className?: string;
}

export function TagBadges({ tags, onTagClick, className = '' }: TagBadgesProps) {
  if (!tags || tags.length === 0) {
    return (
      <div className={className}>
        <p className="text-gray-500 text-sm italic">No tags generated yet</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => onTagClick?.(tag)}
          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium hover:bg-blue-200 transition-colors cursor-pointer"
        >
          <span className="text-base">#</span>
          {tag}
        </button>
      ))}
    </div>
  );
}
