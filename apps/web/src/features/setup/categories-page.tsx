import type { CategoryDTO } from '@sentinel/shared';
import { Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/feedback';
import { Page, PageHeader, Panel } from '../../components/ui/layout';
import { useT } from '../../i18n';
import { CategoriesTable } from './categories-table';
import { CategoryDialog } from './category-dialog';
import { LoadError } from './parts';
import { useCategories } from './queries';
import { SpecialtiesSection } from './specialties-section';

export function CategoriesPage() {
  const { t } = useT();
  const categories = useCategories();
  const [dialog, setDialog] = useState<{ open: boolean; category: CategoryDTO | null }>({ open: false, category: null });

  const openCreate = () => setDialog({ open: true, category: null });
  const openEdit = (category: CategoryDTO) => setDialog({ open: true, category });

  let body: ReactNode;
  if (categories.data) {
    body =
      categories.data.length > 0 ? (
        <CategoriesTable categories={categories.data} onOpen={openEdit} />
      ) : (
        <EmptyState
          title={t('setup.categories.empty.title')}
          description={t('setup.categories.empty.body')}
          action={
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={openCreate}>
              {t('setup.categories.add')}
            </Button>
          }
        />
      );
  } else if (categories.isError) {
    body = <LoadError error={categories.error} onRetry={() => void categories.refetch()} retrying={categories.isFetching} />;
  } else {
    body = <CategoriesTable categories={[]} loading onOpen={openEdit} />;
  }

  return (
    <Page>
      <PageHeader
        title={t('setup.categories.title')}
        description={t('setup.categories.description')}
        actions={
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={openCreate}>
            {t('setup.categories.add')}
          </Button>
        }
      />
      <Panel>{body}</Panel>
      <SpecialtiesSection />
      <CategoryDialog
        open={dialog.open}
        category={dialog.category}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
      />
    </Page>
  );
}
