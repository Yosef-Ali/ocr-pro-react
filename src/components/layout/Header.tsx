import React from 'react';
import { FileText, Settings, HelpCircle, Plus } from 'lucide-react';
import { useOCRStore } from '@/store/ocrStore';
import { useAuth } from '@/contexts/AuthContext';
import { LoginButton, UserProfile } from '@/components/auth';
import { motion } from 'framer-motion';
const MotionDiv = motion.div as any;
const MotionButton = motion.button as any;
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import toast from 'react-hot-toast';
import { LAST_PROJECT_STORAGE_KEY } from '@/store/ocrStore';

export const Header: React.FC = () => {
  const { toggleSettings, toggleHelp, projects, currentProjectId, selectProject, createProject } = useOCRStore();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [projectName, setProjectName] = React.useState('');
  const [projectDescription, setProjectDescription] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const hasAutoSelectedRef = React.useRef(false);

  React.useEffect(() => {
    if (projects.length === 0) {
      hasAutoSelectedRef.current = false;
      return;
    }

    if (currentProjectId) {
      hasAutoSelectedRef.current = true;
      return;
    }

    if (!hasAutoSelectedRef.current) {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(LAST_PROJECT_STORAGE_KEY) : null;
      const fallback = stored && projects.some((p) => p.id === stored) ? stored : projects[0]?.id;
      if (fallback) {
        selectProject(fallback);
        hasAutoSelectedRef.current = true;
      }
    }
  }, [projects, currentProjectId, selectProject]);

  const openCreateDialog = () => {
    setProjectName('');
    setProjectDescription('');
    setFormError(null);
    setCreateOpen(true);
  };

  const closeCreateDialog = () => {
    if (isCreating) return;
    setCreateOpen(false);
    setFormError(null);
  };

  const handleCreateProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!projectName.trim()) {
      setFormError('Project name is required.');
      return;
    }

    setIsCreating(true);
    setFormError(null);
    try {
      await createProject(projectName.trim(), projectDescription.trim() || undefined);
      toast.success('Project created');
      setCreateOpen(false);
      setProjectName('');
      setProjectDescription('');
    } catch (error: any) {
      console.error('Failed to create project', error);
      const message = error?.message || 'Failed to create project';
      setFormError(message);
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };


  return (
    <MotionDiv
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="bg-primary text-primary-foreground shadow-lg"
    >
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <MotionDiv
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.5 }}
              className="w-10 h-10 bg-white rounded-lg flex items-center justify-center"
            >
              <FileText className="w-6 h-6 text-blue-600" />
            </MotionDiv>
            <div>
              <h1 className="text-2xl font-bold">OCR Pro</h1>
              <p className="text-blue-100 text-sm">Powered by OCR engines</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-2 py-1">
              <select
                value={currentProjectId ?? ''}
                onChange={(e) => selectProject(e.target.value || null)}
                className="bg-transparent text-white text-sm outline-none"
              >
                <option value="" className="text-black">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id} className="text-black">
                    {p.name}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 px-2 text-xs"
                onClick={openCreateDialog}
              >
                <Plus className="w-3 h-3" />
                New
              </Button>
            </div>
            <ThemeToggle />
            <MotionButton
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleSettings}
              className="p-2 rounded-lg bg-white/10 backdrop-blur hover:bg-white/20 transition-all"
            >
              <Settings className="w-5 h-5" />
            </MotionButton>

            <MotionButton
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleHelp}
              className="p-2 rounded-lg bg-white/10 backdrop-blur hover:bg-white/20 transition-all"
            >
              <HelpCircle className="w-5 h-5" />
            </MotionButton>

            {/* Authentication Section */}
            <div className="ml-4 pl-4 border-l border-white/20">
              {user ? <UserProfile /> : <LoginButton />}
            </div>
          </div>
        </div>
      </div>
      <Dialog open={createOpen} onOpenChange={(open) => (!open ? closeCreateDialog() : undefined)}>
        <DialogContent>
          <form onSubmit={handleCreateProject}>
            <DialogHeader>
              <DialogTitle>Create new project</DialogTitle>
              <DialogDescription>
                Organize related OCR documents under a named project. You can change this later.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project name</Label>
                <Input
                  id="project-name"
                  value={projectName}
                  placeholder="e.g. Quarterly Report"
                  onChange={(event) => setProjectName(event.target.value)}
                  autoFocus
                  disabled={isCreating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-description">Description (optional)</Label>
                <textarea
                  id="project-description"
                  value={projectDescription}
                  onChange={(event) => setProjectDescription(event.target.value)}
                  disabled={isCreating}
                  className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Add a short note so teammates recognize it"
                />
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={closeCreateDialog}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? (
                  <>
                    <Spinner size="sm" />
                    Creating…
                  </>
                ) : (
                  'Create project'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MotionDiv>
  );
};
