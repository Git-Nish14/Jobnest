"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Tag as TagIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button, Input, Label } from "@/components/ui";
import { TagBadge } from "./tag-badge";
import type { Tag } from "@/types";

const DEFAULT_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // yellow
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
];

interface TagSelectorProps {
  applicationId: string;
  selectedTags: Tag[];
  onTagsChange?: (tags: Tag[]) => void;
}

export function TagSelector({ applicationId, selectedTags, onTagsChange }: TagSelectorProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(DEFAULT_COLORS[0]);
  const [creating, setCreating] = useState(false);

  const fetchTags = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("tags")
      .select("*")
      .order("name", { ascending: true });
    setAllTags(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTags();
  }, [fetchTags]);

  const handleAddTag = async (tag: Tag) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("application_tags")
      .insert({ application_id: applicationId, tag_id: tag.id });

    if (error) {
      if (error.code === "23505") {
        toast.error("Tag already added");
      } else {
        toast.error("Failed to add tag");
      }
      return;
    }

    const newTags = [...selectedTags, tag];
    onTagsChange?.(newTags);
    toast.success(`Added "${tag.name}" tag`);
  };

  const handleRemoveTag = async (tag: Tag) => {
    const supabase = createClient();

    const { error } = await supabase
      .from("application_tags")
      .delete()
      .eq("application_id", applicationId)
      .eq("tag_id", tag.id);

    if (error) {
      toast.error("Failed to remove tag");
      return;
    }

    const newTags = selectedTags.filter((t) => t.id !== tag.id);
    onTagsChange?.(newTags);
    toast.success(`Removed "${tag.name}" tag`);
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    setCreating(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Not authenticated");
      setCreating(false);
      return;
    }

    const { data, error } = await supabase
      .from("tags")
      .insert({ user_id: user.id, name: newTagName.trim(), color: newTagColor })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        toast.error("Tag already exists");
      } else {
        toast.error("Failed to create tag");
      }
      setCreating(false);
      return;
    }

    setAllTags([...allTags, data]);
    setNewTagName("");
    setShowCreate(false);
    toast.success(`Created "${data.name}" tag`);
    setCreating(false);

    // Auto-add the new tag to this application
    handleAddTag(data);
  };

  const availableTags = allTags.filter(
    (tag) => !selectedTags.some((t) => t.id === tag.id)
  );

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading tags...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <TagBadge
              key={tag.id}
              name={tag.name}
              color={tag.color}
              onRemove={() => handleRemoveTag(tag)}
            />
          ))}
        </div>
      )}

      {/* Available Tags */}
      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => handleAddTag(tag)}
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-dashed hover:border-solid transition-all"
              style={{ borderColor: tag.color, color: tag.color }}
            >
              <Plus className="h-3 w-3" />
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {/* Create New Tag */}
      {showCreate ? (
        <form onSubmit={handleCreateTag} className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="newTag" className="text-xs">New tag name</Label>
            <Input
              id="newTag"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="e.g., Dream Job"
              className="h-8 text-sm"
              autoFocus
            />
          </div>
          <div className="flex gap-1">
            {DEFAULT_COLORS.slice(0, 4).map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setNewTagColor(color)}
                className={`w-6 h-6 rounded-full border-2 ${
                  newTagColor === color ? "border-foreground" : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <Button type="submit" size="sm" disabled={creating || !newTagName.trim()}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowCreate(false)}
          >
            Cancel
          </Button>
        </form>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreate(true)}
          className="gap-1"
        >
          <TagIcon className="h-3 w-3" />
          Create Tag
        </Button>
      )}
    </div>
  );
}
