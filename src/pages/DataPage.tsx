import { useEffect, useMemo, useState } from 'react';
import { Shell } from '../components/Shell';
import { CategoryProjectCompare } from '../components/CategoryProjectCompare';
import { ComparePositions } from '../components/ComparePositions';
import { PositionCard } from '../components/PositionCard';
import { StatusBadge } from '../components/StatusBadge';
import { PROJECT_STATUSES } from '../constants/projectStatus';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { exportProjectCSV } from '../services/export';
import { fetchCategorySummaries } from '../services/insights';
import { ensureDefaultCategories, groupItemsByProject } from '../services/categories';
import { updateProject } from '../services/projects';
import { recordPriceSnapshot } from '../services/priceHistory';
import { PriceHistoryDashboard } from '../components/PriceHistoryDashboard';
import type { CategorySummary, DbCategory, DbProject, DbProjectItem, ItemWithMeta } from '../types/database';

const ITEM_SELECT = '*, projects(name), categories(name)';

export function DataPage() {
  const { showToast } = useToast();
  const [projectsList, setProjectsList] = useState<DbProject[]>([]);
  const [categoriesList, setCategoriesList] = useState<DbCategory[]>([]);
  const [selectedProject, setSelectedProject] = useState<DbProject | null>(null);
  const [projectItems, setProjectItems] = useState<ItemWithMeta[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<DbCategory | null>(null);
  const [categoryItems, setCategoryItems] = useState<ItemWithMeta[]>([]);
  const [comparePool, setComparePool] = useState<ItemWithMeta[]>([]);
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    description: '',
    position_number: '',
    unit: '',
    quantity: 0,
    category_id: '',
    project_id: '',
    materialPrice: 0,
    laborPrice: 0,
    days: 0,
    foodPrice: 0,
    location: '',
    transportPrice: 0,
    otherPrice: 0,
    profitPercent: 0,
    vatPercent: 18,
  });
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [categorySummaries, setCategorySummaries] = useState<CategorySummary[]>([]);
  const [metaClient, setMetaClient] = useState('');
  const [metaStatus, setMetaStatus] = useState('draft');
  const [metaDescription, setMetaDescription] = useState('');
  const [metaActualCost, setMetaActualCost] = useState('');
  const [metaActualNotes, setMetaActualNotes] = useState('');
  const [projectAnalysis, setProjectAnalysis] = useState<string[] | null>(null);

  const reloadProjects = async () => {
    if (!supabase) return;
    const cats = await ensureDefaultCategories();
    const { data: projects } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
    const list = projects || [];
    setProjectsList(list);
    setCategoriesList(cats);
    setCategorySummaries(await fetchCategorySummaries(cats));
  };

  const loadComparePool = async (categoryId?: string) => {
    if (!supabase) return;
    let query = supabase.from('project_items').select(ITEM_SELECT).order('created_at', { ascending: false }).limit(300);
    if (categoryId) query = query.eq('category_id', categoryId);
    const { data } = await query;
    setComparePool((data as ItemWithMeta[]) || []);
  };

  useEffect(() => {
    reloadProjects();
    loadComparePool();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      setMetaClient(selectedProject.client || '');
      setMetaStatus(selectedProject.status || 'draft');
      setMetaDescription(selectedProject.description || '');
      setMetaActualCost(selectedProject.actual_total_cost != null ? String(selectedProject.actual_total_cost) : '');
      setMetaActualNotes(selectedProject.actual_notes || '');
    }
  }, [selectedProject]);

  const loadProjectDetails = async (project: DbProject) => {
    if (!supabase) return;
    if (selectedProject?.id === project.id) {
      setSelectedProject(null);
      setProjectItems([]);
      setSelectedItemId(null);
      return;
    }
    setSelectedProject(project);
    setSelectedCategory(null);
    setCategoryItems([]);
    setItemSearchTerm('');
    setSelectedItemId(null);
    const { data } = await supabase
      .from('project_items')
      .select(ITEM_SELECT)
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });
    const items = (data as ItemWithMeta[]) || [];
    setProjectItems(items);
    setComparePool(items);
    setCompareA('');
    setCompareB('');
  };

  const loadCategoryDetails = async (category: DbCategory) => {
    if (!supabase) return;
    if (selectedCategory?.id === category.id) {
      setSelectedCategory(null);
      setCategoryItems([]);
      setSelectedItemId(null);
      return;
    }
    setSelectedCategory(category);
    setSelectedProject(null);
    setProjectItems([]);
    setItemSearchTerm('');
    setSelectedItemId(null);
    const { data } = await supabase
      .from('project_items')
      .select(ITEM_SELECT)
      .eq('category_id', category.id)
      .order('created_at', { ascending: false });
    const items = (data as ItemWithMeta[]) || [];
    setCategoryItems(items);
    setComparePool(items);
    await loadComparePool(category.id);
    setCompareA('');
    setCompareB('');
  };

  const saveProjectMeta = async () => {
    if (!selectedProject) return;
    const { error } = await updateProject(selectedProject.id, {
      client: metaClient.trim() || null,
      status: metaStatus,
      description: metaDescription.trim() || null,
      actual_total_cost: metaActualCost.trim() === '' ? null : Number(metaActualCost),
      actual_notes: metaActualNotes.trim() || null,
    });
    if (error) {
      showToast(error, 'error');
      return;
    }
    showToast('Projekti u përditësua.', 'success');
    await reloadProjects();
  };

  const analyzeSelectedProject = () => {
    if (!selectedProject) return;
    const items = projectItems || [];
    const total = items.reduce((s, it) => s + Number(it.total_price || 0), 0);
    const avgUnit = items.length ? items.reduce((s, it) => s + Number(it.unit_price || 0), 0) / items.length : 0;
    const top = [...items].sort((a, b) => Number(b.unit_price) - Number(a.unit_price)).slice(0, 5);
    const suggestions: string[] = [];
    suggestions.push(`Totali i projektit: ${total.toFixed(2)} € — ${items.length} pozicione`);
    suggestions.push(`Çmimi mesatar për njësi: ${avgUnit.toFixed(2)} €`);
    if (avgUnit > 50) suggestions.push('Çmimi mesatar është i lartë — kontrollo materialet dhe punën për pozicionet kryesore.');
    if (items.length === 0) suggestions.push('Nuk ka pozicione në këtë projekt.');
    if (top.length > 0) {
      suggestions.push('Top pozicionet sipas çmimit për njësi: ' + top.map((t) => `${t.description} (${Number(t.unit_price).toFixed(2)}€)`).join('; '));
    }
    // Quick heuristic: many zero quantities
    const zeroQty = items.filter((i) => Number(i.quantity) <= 0).length;
    if (zeroQty > 0) suggestions.push(`${zeroQty} pozicione me sasi 0 — verifiko sasinë.`);
    setProjectAnalysis(suggestions);
  };

  const startEdit = async (item: DbProjectItem) => {
    setEditingId(item.id);
    setSelectedItemId(item.id);

    // Fetch expenses to pre-fill the form, if any exist
    let materialPrice = 0, laborPrice = 0, days = 0, foodPrice = 0, transportPrice = 0, otherPrice = 0;
    if (supabase) {
      const { data: expenses } = await supabase.from('item_expenses').select('*').eq('project_item_id', item.id);
      if (expenses) {
        expenses.forEach(exp => {
          if (exp.expense_type === 'material') materialPrice = Number(exp.unit_cost) || 0;
          if (exp.expense_type === 'labor') laborPrice = Number(exp.unit_cost) || 0;
          if (exp.expense_type === 'food') {
            foodPrice = Number(exp.unit_cost) || 0;
            days = Number(exp.quantity) || days;
          }
          if (exp.expense_type === 'transport') {
            transportPrice = Number(exp.unit_cost) || 0;
            days = Number(exp.quantity) || days;
          }
          if (exp.expense_type === 'other') otherPrice = Number(exp.unit_cost) || 0;
        });
      }
    }

    // Default to the original unit_price logic if expenses are missing (fallback)
    if (materialPrice === 0 && laborPrice === 0 && otherPrice === 0) {
      materialPrice = Number(item.unit_price) || 0;
    }

    setEditForm({
      description: item.description || '',
      position_number: item.position_number || '',
      unit: item.unit || '',
      quantity: Number(item.quantity) || 0,
      category_id: item.category_id || '',
      project_id: item.project_id || '',
      materialPrice,
      laborPrice,
      days,
      foodPrice,
      location: '', 
      transportPrice,
      otherPrice,
      profitPercent: 0, 
      vatPercent: 18,   
    });
  };

  const saveRowEdit = async () => {
    if (!supabase || !editingId) return;
    const now = new Date().toISOString();
    
    const quantity = Number(editForm.quantity) || 0;
    const days = Number(editForm.days) || 0;
    
    const materialTotal = quantity * (Number(editForm.materialPrice) || 0);
    const laborTotal = quantity * (Number(editForm.laborPrice) || 0);
    const foodTotal = days * (Number(editForm.foodPrice) || 0);
    const transportTotal = days * (Number(editForm.transportPrice) || 0);
    const otherTotal = Number(editForm.otherPrice) || 0;

    const subtotal = materialTotal + laborTotal + foodTotal + transportTotal + otherTotal;
    const profitAmount = subtotal * ((Number(editForm.profitPercent) || 0) / 100);
    const vatBase = subtotal + profitAmount;
    const vatAmount = vatBase * ((Number(editForm.vatPercent) || 18) / 100);
    
    const total = vatBase + vatAmount;
    const unitPrice = quantity > 0 ? total / quantity : total;

    const { error: itemError } = await supabase
      .from('project_items')
      .update({
        description: editForm.description,
        position_number: editForm.position_number,
        unit: editForm.unit,
        quantity: quantity,
        category_id: editForm.category_id || null,
        unit_price: unitPrice,
        total_price: total,
        updated_at: now,
      })
      .eq('id', editingId);

    if (itemError) {
      showToast(itemError.message, 'error');
      return;
    }

    // Update item expenses (delete old, insert new)
    await supabase.from('item_expenses').delete().eq('project_item_id', editingId);
    await supabase.from('item_expenses').insert([
      { project_item_id: editingId, expense_type: 'material', description: 'Material', unit_cost: Number(editForm.materialPrice) || 0, quantity, total_cost: materialTotal },
      { project_item_id: editingId, expense_type: 'labor', description: 'Puna', unit_cost: Number(editForm.laborPrice) || 0, quantity, total_cost: laborTotal },
      { project_item_id: editingId, expense_type: 'food', description: 'Ushqim', unit_cost: Number(editForm.foodPrice) || 0, quantity: days, total_cost: foodTotal },
      { project_item_id: editingId, expense_type: 'transport', description: 'Transport', unit_cost: Number(editForm.transportPrice) || 0, quantity: days, total_cost: transportTotal },
      { project_item_id: editingId, expense_type: 'other', description: 'Tjera', unit_cost: otherTotal, quantity: 1, total_cost: otherTotal },
    ]);

    // Historiku i çmimeve: shto NJË REKORD TË RI (s'e fshin/mbishkruan historinë e mëparshme),
    // që të mund të shihet si ka ndryshuar çmimi i këtij pozicioni me kohë.
    await recordPriceSnapshot({
      project_item_id: editingId,
      project_id: editForm.project_id || null,
      category_id: editForm.category_id || null,
      description: editForm.description,
      unit: editForm.unit,
      material_price: Number(editForm.materialPrice) || 0,
      labor_price: Number(editForm.laborPrice) || 0,
      quantity,
      unit_price: unitPrice,
      total_price: total,
      profit_percent: Number(editForm.profitPercent) || 0,
    });

    setEditingId(null);
    showToast('Pozicioni u përditësua.', 'success');
    if (selectedProject) await loadProjectDetails(selectedProject);
    if (selectedCategory) await loadCategoryDetails(selectedCategory);
    await reloadProjects();
  };

  const handleExport = async () => {
    if (!selectedProject) return;
    const result = await exportProjectCSV(selectedProject.id);
    if (result.ok) showToast('CSV u shkarkua.', 'success');
    else showToast(result.message || 'Gabim', 'error');
  };

  const filteredProjects = projectsList.filter((p) => {
    const matchesName = p.name.toLowerCase().includes(projectFilter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (p.status || 'draft') === statusFilter;
    return matchesName && matchesStatus;
  });

  const categoryGroups = useMemo(
    () => (selectedCategory ? groupItemsByProject(categoryItems) : []),
    [selectedCategory, categoryItems]
  );

  const filterProjectItems = projectItems.filter(
    (item) =>
      !itemSearchTerm ||
      String(item.description).toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
      String(item.position_number || '').toLowerCase().includes(itemSearchTerm.toLowerCase())
  );

  const renderPositionList = (items: ItemWithMeta[]) => (
    <div className="position-card-list">
      {items.map((item) => (
        <PositionCard
          key={item.id}
          item={item}
          selected={selectedItemId === item.id}
          onSelect={() => setSelectedItemId(item.id === selectedItemId ? null : item.id)}
          onEdit={() => startEdit(item)}
          onCompareA={() => setCompareA(item.id)}
          onCompareB={() => setCompareB(item.id)}
          editing={editingId === item.id}
          editForm={editForm}
          onEditFormChange={setEditForm}
          onSave={saveRowEdit}
          onCancel={() => setEditingId(null)}
          categories={categoriesList}
        />
      ))}
    </div>
  );


  return (
    <Shell>
      <div className="page-header">
        <h1>Të dhënat</h1>
        <p className="muted">
          Krahaso ofertat që ke dërguar në projekte të ndryshme — p.sh. pllaka në Qkuk vs Polici. Zgjidh kategori ose projekt, pastaj
          krahaso dy pozicione.
        </p>
      </div>

      <div className="data-layout">
        <div className="data-main">
          <section className="panel form-section">
            <h3 className="panel-title">1. Projektet (ofertat)</h3>
            <div className="status-filter-row">
              <button type="button" className={`filter-chip ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>
                Të gjitha
              </button>
              {PROJECT_STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`filter-chip ${statusFilter === s.value ? 'active' : ''}`}
                  onClick={() => setStatusFilter(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <label>
              Kërko projekte
              <input value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} placeholder="Qkuk, Polici..." />
            </label>
            <div className="projects-list">
              {filteredProjects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  className={`project-item ${selectedProject?.id === project.id ? 'selected' : ''}`}
                  onClick={() => loadProjectDetails(project)}
                >
                  <strong>{project.name}</strong>
                  <span className="project-item-meta">
                    {project.client || 'Pa klient'} · <StatusBadge status={project.status} />
                  </span>
                </button>
              ))}
              {filteredProjects.length === 0 && <span className="muted">Nuk ka projekte.</span>}
            </div>
          </section>

          <section className="panel form-section">
            <h3 className="panel-title">2. Kategoritë</h3>
            <p className="muted category-hint">Kliko Pllaka, Ujë… — shfaqen ofertat nga të gjithë projektet + krahasim mes projekteve.</p>
            <div className="category-wrap">
              {categoriesList.map((category) => {
                const summary = categorySummaries.find((s) => s.id === category.id);
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={`chip-button ${selectedCategory?.id === category.id ? 'chip-selected' : ''}`}
                    onClick={() => loadCategoryDetails(category)}
                  >
                    {category.name}
                    {summary && summary.count > 0 ? ` (${summary.count})` : ''}
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="data-sidebar">
          <ComparePositions
            items={comparePool}
            slotA={compareA}
            slotB={compareB}
            onSlotA={setCompareA}
            onSlotB={setCompareB}
          />
        </aside>
      </div>

      <PriceHistoryDashboard categories={categoriesList} />

      {selectedProject && (
        <section className="panel panel-top-gap">
          <h3 className="panel-heading-accent">Oferta: {selectedProject.name}</h3>

          <div className="project-meta-panel">
            <label>
              Klienti
              <input value={metaClient} onChange={(e) => setMetaClient(e.target.value)} />
            </label>
            <label>
              Statusi
              <select value={metaStatus} onChange={(e) => setMetaStatus(e.target.value)}>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </label>
            <label>
              Përshkrimi
              <input value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} />
            </label>
            <label>
              Kosto reale finale (€)
              <input
                type="number"
                step="0.01"
                value={metaActualCost}
                onChange={(e) => setMetaActualCost(e.target.value)}
                placeholder="Plotëso kur projekti mbyllet"
              />
              <span className="field-hint">Sa ka kushtuar realisht (jo çmimi i ofertës) — krahasohet automatikisht te "Analiza e çmimeve".</span>
            </label>
            <label>
              Shënime mbi koston reale
              <input value={metaActualNotes} onChange={(e) => setMetaActualNotes(e.target.value)} placeholder="p.sh. shtrenjtim materiali, ditë shtesë..." />
            </label>
            <div className="form-actions-row">
              <button type="button" className="primary-button" onClick={saveProjectMeta}>Ruaj projektin</button>
              <button type="button" className="card" onClick={analyzeSelectedProject}>Kontrollo projektin</button>
            </div>
          </div>

          <div className="project-controls">
            <label>
              Kërko pozicione
              <input value={itemSearchTerm} onChange={(e) => setItemSearchTerm(e.target.value)} placeholder="Kërko..." />
            </label>
            <button type="button" className="card" onClick={handleExport}>Export CSV</button>
          </div>

          {filterProjectItems.length > 0 ? renderPositionList(filterProjectItems) : <p className="muted">Ska pozicione në këtë projekt.</p>}
          {projectAnalysis && (
            <div className="panel data-analysis-panel">
              <h4 className="panel-title">Analizë e shpejtë</h4>
              <ul>
                {projectAnalysis.map((s, i) => (
                  <li key={i} className="muted">{s}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {selectedCategory && (
        <section className="panel panel-top-gap">
          <h3 className="panel-heading-accent">
            Kategoria: {selectedCategory.name} — {categoryItems.length} pozicione, {categoryGroups.length} projekte
          </h3>

          <CategoryProjectCompare groups={categoryGroups} categoryName={selectedCategory.name} />

          {categoryItems.length > 0 ? (
            <div className="category-groups">
              {categoryGroups.map((group) => (
                <div key={group.projectId} className="category-project-group">
                  <div className="category-group-header">
                    <strong>{group.projectName}</strong>
                    <span className="muted">{group.items.length} pozicione në këtë ofertë</span>
                  </div>
                  {renderPositionList(group.items as ItemWithMeta[])}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Ska pozicione për këtë kategori ende.</p>
          )}
        </section>
      )}
    </Shell>
  );
}