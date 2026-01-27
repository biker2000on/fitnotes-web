'use client';

import { useState, useEffect, useTransition } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/actions/categories';

type Category = { id: number; name: string; color: string; sortOrder: number };

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E', '#78716C', '#71717A', '#64748B',
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    const data = await getCategories();
    setCategories(data);
  };

  const resetForm = () => {
    setName('');
    setColor('#3B82F6');
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    startTransition(async () => {
      await createCategory({ name: name.trim(), color });
      await loadCategories();
      setIsAddDialogOpen(false);
      resetForm();
    });
  };

  const handleUpdate = async () => {
    if (!selectedCategory || !name.trim()) return;
    startTransition(async () => {
      await updateCategory(selectedCategory.id, { name: name.trim(), color });
      await loadCategories();
      setIsEditDialogOpen(false);
      setSelectedCategory(null);
      resetForm();
    });
  };

  const handleDelete = async () => {
    if (!selectedCategory) return;
    startTransition(async () => {
      await deleteCategory(selectedCategory.id);
      await loadCategories();
      setIsDeleteDialogOpen(false);
      setSelectedCategory(null);
    });
  };

  const openEditDialog = (category: Category) => {
    setSelectedCategory(category);
    setName(category.name);
    setColor(category.color);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (category: Category) => {
    setSelectedCategory(category);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div>
      <Header title="Categories" />
      <div className="p-4 space-y-4">
        <Button onClick={() => { resetForm(); setIsAddDialogOpen(true); }} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          New Category
        </Button>

        <ScrollArea className="h-[calc(100vh-200px)]">
          {categories.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No categories yet. Create your first category!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-6 w-6 rounded-full border"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="font-medium">{category.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(category)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(category)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Add Category Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Chest, Back, Legs"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="grid grid-cols-10 gap-2">
                {PRESET_COLORS.map((presetColor) => (
                  <button
                    key={presetColor}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 transition-transform ${
                      color === presetColor ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: presetColor }}
                    onClick={() => setColor(presetColor)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label htmlFor="custom-color" className="text-sm text-muted-foreground">Custom:</Label>
                <Input
                  id="custom-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-8 w-16 p-1 cursor-pointer"
                />
                <span className="text-sm text-muted-foreground">{color}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setIsAddDialogOpen(false); resetForm(); }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || isPending}>
              {isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-category-name">Name</Label>
              <Input
                id="edit-category-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Chest, Back, Legs"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="grid grid-cols-10 gap-2">
                {PRESET_COLORS.map((presetColor) => (
                  <button
                    key={presetColor}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 transition-transform ${
                      color === presetColor ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: presetColor }}
                    onClick={() => setColor(presetColor)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label htmlFor="edit-custom-color" className="text-sm text-muted-foreground">Custom:</Label>
                <Input
                  id="edit-custom-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-8 w-16 p-1 cursor-pointer"
                />
                <span className="text-sm text-muted-foreground">{color}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setIsEditDialogOpen(false); setSelectedCategory(null); resetForm(); }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={!name.trim() || isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedCategory?.name}"? Exercises in this category will become uncategorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setIsDeleteDialogOpen(false); setSelectedCategory(null); }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
