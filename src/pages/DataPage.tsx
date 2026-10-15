import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { BarChart3, ClipboardCheck, Download, Search, Save, Trash2 } from 'lucide-react';
import { Shell } from '../components/Shell';
import { CategoryProjectCompare } from '../components/CategoryProjectCompare';
import { ComparePositions } from '../components/ComparePositions';
import { PositionCard, type PositionEditForm } from '../components/PositionCard';
import { StatusBadge } from '../components/StatusBadge';
import { PROJECT_STATUSES, type ProjectStatus } from '../constants/projectStatus';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { exportProjectCSV } from '../services/export';
import { categoryNameKey, ensureDefaultCategories, groupItemsByProject, deleteCategory, uniqueCategories } from '../services/categories';
import { updateProject, deleteProject, deletePosition } from '../services/projects';
import { recordPriceSnapshot } from '../services/priceHistory';
import { calculatePositionPrice } from '../lib/pricing';
import { PriceHistoryDashboard } from '../components/PriceHistoryDashboard';
import { RevenueTrendChart } from '../components/RevenueTrendChart';
import type { CategorySummary, DbCategory, DbProject, DbProjectItem, ItemWithMeta } from '../types/database';
import { fetchCategorySummaries, fetchMonthlyRevenueTrend, type MonthlyRevenuePoint } from '../services/insights';

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
  const [editForm, setEditForm] = useState<PositionEditForm>({
    description: '',
    position_number: '',
    unit: '',
    quantity: '',
    category_id: '',
    project_id: '',
    materialPrice: '',
    laborPrice: '',
    days: '',
    foodPrice: '',
    location: '',
    transportPrice: '',
    otherPrice: '',
    profitPercent: '',
    vatPercent: '18',
  });
  const [originalEditForm, setOriginalEditForm] = useState<PositionEditForm | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [categorySummaries, setCategorySummaries] = useState<CategorySummary[]>([]);
  const [metaClient, setMetaClient] = useState('');
  const [metaStatus, setMetaStatus] = useState('draft');
  const [metaDescription, setMetaDescription] = useState('');
  const [metaActualCost, setMetaActualCost] = useState('');
  const [metaActualNotes, setMetaActualNotes] = useState('');
  const [projectAnalysis, setProjectAnalysis] = useState<string[] | null>(null);
  const [monthlyRevenueTrend, setMonthlyRevenueTrend] = useState<MonthlyRevenuePoint[]>([]);
  const [trendStatus, setTrendStatus] = useState<ProjectStatus | 'all'>('all');
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [analysisRefreshKey, setAnalysisRefreshKey] = useState(0);
  const detailRequestId = useRef(0);

  const reloadProjects = async () => {
    if (!supabase) return;
    try {
      const cats = await ensureDefaultCategories();
      const { data: projects, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (error) throw new Error(`Projektet nuk u ngarkuan: ${error.message}`);
      const summaries = await fetchCategorySummaries(cats);
      setProjectsList(projects || []);
      setCategoriesList(cats);
      setCategorySummaries(summaries);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Të dhënat e projekteve nuk u rifreskuan.', 'error');
    }
  };

  const loadComparePool = async (categoryIds?: string | string[], requestId = detailRequestId.current) => {
    if (!supabase) return;
    let query = supabase.from('project_items').select(ITEM_SELECT).order('created_at', { ascending: false }).limit(300);
    if (Array.isArray(categoryIds) && categoryIds.length > 0) query = query.in('category_id', categoryIds);
    else if (typeof categoryIds === 'string' && categoryIds) query = query.eq('category_id', categoryIds);
    const { data, error } = await query;
    if (requestId !== detailRequestId.current) return;
    if (error) {
      setComparePool([]);
      showToast(`Pozicionet për krahasim nuk u ngarkuan: ${error.message}`, 'error');
      return;
    }
    setComparePool((data as ItemWithMeta[]) || []);
  };

  useEffect(() => {
    void reloadProjects();
    void loadComparePool(undefined, detailRequestId.current);
  }, []);

  useEffect(() => {
    let active = true;
    setTrendLoading(true);
    setTrendError(null);
    fetchMonthlyRevenueTrend(trendStatus)
      .then((points) => {
        if (active) setMonthlyRevenueTrend(points);
      })
      .catch((error: unknown) => {
        if (active) setTrendError(error instanceof Error ? error.message : 'Trendi i ofertave nuk u ngarkua.');
      })
      .finally(() => {
        if (active) setTrendLoading(false);
      });
    return () => {
      active = false;
    };
  }, [trendStatus, projectsList]);

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
    const requestId = ++detailRequestId.current;
    if (selectedProject?.id === project.id) {
      setSelectedProject(null);
      setProjectItems([]);
      setSelectedItemId(null);
      setComparePool([]);
      return;
    }
    setSelectedProject(project);
    setSelectedCategory(null);
    setProjectItems([]);
    setCategoryItems([]);
    setComparePool([]);
    setItemSearchTerm('');
    setSelectedItemId(null);
    const { data, error } = await supabase
      .from('project_items')
      .select(ITEM_SELECT)
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });
    if (requestId !== detailRequestId.current) return;
    if (error) {
      setProjectItems([]);
      setComparePool([]);
      showToast(`Pozicionet e projektit nuk u ngarkuan: ${error.message}`, 'error');
      return;
    }
    const items = (data as ItemWithMeta[]) || [];
    setProjectItems(items);
    setComparePool(items);
    setCompareA('');
    setCompareB('');
  };

  const loadCategoryDetails = async (category: DbCategory) => {
    if (!supabase) return;
    const requestId = ++detailRequestId.current;
    if (selectedCategory?.id === category.id) {
      setSelectedCategory(null);
      setCategoryItems([]);
      setSelectedItemId(null);
      setComparePool([]);
      return;
    }
    setSelectedCategory(category);
    setSelectedProject(null);
    setProjectItems([]);
    setCategoryItems([]);
    setComparePool([]);
    setItemSearchTerm('');
    setSelectedItemId(null);
    const matchingCategoryIds = categoriesList
      .filter((entry) => categoryNameKey(entry.name) === categoryNameKey(category.name))
      .map((entry) => entry.id);
    const { data, error } = await supabase
      .from('project_items')
      .select(ITEM_SELECT)
      .in('category_id', matchingCategoryIds)
      .order('created_at', { ascending: false });
    if (requestId !== detailRequestId.current) return;
    if (error) {
      setCategoryItems([]);
      setComparePool([]);
      showToast(`Pozicionet e kategorisë nuk u ngarkuan: ${error.message}`, 'error');
      return;
    }
    const items = (data as ItemWithMeta[]) || [];
    setCategoryItems(items);
    setComparePool(items.slice(0, 300));
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
    setAnalysisRefreshKey((key) => key + 1);
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;
    const confirmed = window.confirm(
      `Të fshihet plotësisht projekti "${selectedProject.name}"? Kjo do të fshijë edhe të gjitha pozicionet e tij. Veprim i pakthyeshëm.`
    );
    if (!confirmed) return;
    const { error } = await deleteProject(selectedProject.id);
    if (error) {
      showToast(error, 'error');
      return;
    }
    showToast('Projekti u fshi.', 'success');
    setSelectedProject(null);
    await reloadProjects();
  };

  const handleDeletePosition = async (item: DbProjectItem) => {
    const confirmed = window.confirm(`Të fshihet pozicioni "${item.description}"? Veprim i pakthyeshëm.`);
    if (!confirmed) return;
    const { error } = await deletePosition(item.id);
    if (error) {
      showToast(error, 'error');
      return;
    }
    showToast('Pozicioni u fshi.', 'success');
    if (selectedProject) await loadProjectDetails(selectedProject);
    if (selectedCategory) await loadCategoryDetails(selectedCategory);
  };

  const handleDeleteCategory = async (category: DbCategory, event: MouseEvent) => {
    event.stopPropagation();
    const confirmed = window.confirm(
      `Të fshihet kategoria "${category.name}"? Pozicionet që e përdorin mbeten (bëhen "pa kategori"). Kujdes: nëse është kategori standarde, mund të rikrijohet automatikisht herën tjetër.`
    );
    if (!confirmed) return;
    const { error } = await deleteCategory(category.id);
    if (error) {
      showToast(error, 'error');
      return;
    }
    showToast('Kategoria u fshi.', 'success');
    try {
      const cats = await ensureDefaultCategories();
      setCategoriesList(cats);
      if (selectedCategory?.id === category.id) setSelectedCategory(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Kategoritë nuk u rifreskuan pas fshirjes.', 'error');
    }
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

    const profitPercent = Number(item.profit_percent) || 0;
    const vatPercent = item.vat_percent == null ? 18 : Number(item.vat_percent);
    let materialPrice = 0, laborPrice = 0, days = 0, foodPrice = 0, transportPrice = 0, otherPrice = 0;
    if (supabase) {
      const { data: expenses, error } = await supabase.from('item_expenses').select('*').eq('project_item_id', item.id);
      if (error) {
        showToast(`Shpenzimet nuk mund të lexohen: ${error.message}`, 'error');
        setEditingId(null);
        return;
      }
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
        if (expenses.length === 0) {
          const quantity = Number(item.quantity) || 0;
          const marginFactor = (1 + profitPercent / 100) * (1 + vatPercent / 100);
          if (quantity > 0 && marginFactor > 0) {
            materialPrice = Number(item.total_price) / marginFactor / quantity;
          }
        }
      }
    }

    setEditForm({
      description: item.description || '',
      position_number: item.position_number || '',
      unit: item.unit || '',
      quantity: String(Number(item.quantity) || 0),
      category_id: item.category_id || '',
      project_id: item.project_id || '',
      materialPrice: String(materialPrice),
      laborPrice: String(laborPrice),
      days: String(days),
      foodPrice: String(foodPrice),
      location: '',
      transportPrice: String(transportPrice),
      otherPrice: String(otherPrice),
      profitPercent: String(profitPercent),
      vatPercent: String(vatPercent),
    });
    setOriginalEditForm({
      description: item.description || '',
      position_number: item.position_number || '',
      unit: item.unit || '',
      quantity: String(Number(item.quantity) || 0),
      category_id: item.category_id || '',
      project_id: item.project_id || '',
      materialPrice: String(materialPrice),
      laborPrice: String(laborPrice),
      days: String(days),
      foodPrice: String(foodPrice),
      location: '',
      transportPrice: String(transportPrice),
      otherPrice: String(otherPrice),
      profitPercent: String(profitPercent),
      vatPercent: String(vatPercent),
    });
  };

  const saveRowEdit = async () => {
    if (!supabase || !editingId) return;
    const now = new Date().toISOString();
    const quantity = Number(editForm.quantity);
    const days = Number(editForm.days);
    if (!editForm.description.trim() || !Number.isFinite(quantity) || quantity <= 0) {
      showToast('Përshkrimi është i detyrueshëm dhe sasia duhet të jetë më e madhe se 0.', 'error');
      return;
    }
    if (!Number.isFinite(days) || days < 0) {
      showToast('Ditët e punës duhet të jenë një numër zero ose më i madh.', 'error');
      return;
    }

    const breakdown = calculatePositionPrice({
      quantity,
      materialPrice: Number(editForm.materialPrice),
      laborPrice: Number(editForm.laborPrice),
      days,
      foodPrice: Number(editForm.foodPrice),
      transportPrice: Number(editForm.transportPrice),
      otherPrice: Number(editForm.otherPrice),
      profitPercent: Number(editForm.profitPercent) || 0,
      vatPercent: editForm.vatPercent === '' ? 18 : Number(editForm.vatPercent) || 0,
    });
    const { materialTotal, laborTotal, foodTotal, transportTotal, otherTotal, total, unitPrice } = breakdown;
    const expenses = [
      { expense_type: 'material', description: 'Material', unit_cost: Number(editForm.materialPrice) || 0, quantity, total_cost: materialTotal },
      { expense_type: 'labor', description: 'Puna', unit_cost: Number(editForm.laborPrice) || 0, quantity, total_cost: laborTotal },
      { expense_type: 'food', description: 'Ushqim', unit_cost: Number(editForm.foodPrice) || 0, quantity: days, total_cost: foodTotal },
      { expense_type: 'transport', description: `Transport: ${editForm.location.trim() || 'Pa qytet'}`, unit_cost: Number(editForm.transportPrice) || 0, quantity: days, total_cost: transportTotal },
      { expense_type: 'other', description: 'Tjera', unit_cost: otherTotal, quantity: 1, total_cost: otherTotal },
    ];

    const { error: itemError } = await supabase.rpc('update_project_position', {
      p_item_id: editingId,
      p_item: {
        description: editForm.description.trim(),
        position_number: editForm.position_number.trim() || null,
        unit: editForm.unit,
        quantity,
        category_id: editForm.category_id || null,
        unit_price: unitPrice,
        total_price: total,
        profit_percent: Number(editForm.profitPercent) || 0,
        vat_percent: editForm.vatPercent === '' ? 18 : Number(editForm.vatPercent) || 0,
        updated_at: now,
      },
      p_expenses: expenses,
    });
    if (itemError) {
      showToast(`Pozicioni dhe kostot nuk u përditësuan: ${itemError.message}`, 'error');
      return;
    }

    // Historiku i çmimeve: shto NJË REKORD TË RI (s'e fshin/mbishkruan historinë e mëparshme),
    // që të mund të shihet si ka ndryshuar çmimi i këtij pozicioni me kohë.
    const priceHistoryResult = await recordPriceSnapshot({
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
    setOriginalEditForm(null);
    showToast('Pozicioni u përditësua.', 'success');
    if (priceHistoryResult.error) {
      showToast(`Pozicioni u përditësua, por historiku i çmimeve jo: ${priceHistoryResult.error}`, 'error');
    }
    if (selectedProject) await loadProjectDetails(selectedProject);
    if (selectedCategory) await loadCategoryDetails(selectedCategory);
    await reloadProjects();
    setAnalysisRefreshKey((key) => key + 1);
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
  const visibleCategories = useMemo(() => uniqueCategories(categoriesList), [categoriesList]);

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
          onCancel={() => {
            setEditingId(null);
            setOriginalEditForm(null);
            setSelectedItemId(null);
          }}
          onReset={() => originalEditForm && setEditForm({ ...originalEditForm })}
          onDelete={() => handleDeletePosition(item)}
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
              {visibleCategories.map((category) => {
                const categoryIds = categoriesList
                  .filter((entry) => categoryNameKey(entry.name) === categoryNameKey(category.name))
                  .map((entry) => entry.id);
                const matchingSummaries = categorySummaries.filter((summary) => categoryIds.includes(summary.id));
                const summaryCount = matchingSummaries.reduce((total, summary) => total + summary.count, 0);
                return (
                  <button
                    key={category.id}
                    type="button"
                    className={`chip-button ${selectedCategory?.id === category.id ? 'chip-selected' : ''}`}
                    onClick={() => loadCategoryDetails(category)}
                  >
                    {category.name}
                    {summaryCount > 0 ? ` (${summaryCount})` : ''}
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

      {selectedProject && (
        <section className="panel panel-top-gap project-detail-panel">
          <header className="project-detail-header">
            <div>
              <span className="project-detail-eyebrow">Menaxhimi i ofertës</span>
              <h2>{selectedProject.name}</h2>
              <p>
                {metaClient.trim() || 'Klient i papërcaktuar'}
                <span aria-hidden="true"> · </span>
                {projectItems.length} pozicione në ofertë
              </p>
            </div>
            <div className="project-detail-status">
              <span>Statusi i projektit</span>
              <StatusBadge status={metaStatus} />
            </div>
          </header>

          <div className="project-meta-panel">
            <div className="project-meta-grid">
              <label>
                Klienti
                <input value={metaClient} onChange={(e) => setMetaClient(e.target.value)} placeholder="Emri i klientit" />
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
                Përshkrimi i projektit
                <input value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} placeholder="Përshkrim i shkurtër (opsional)" />
              </label>
              <div className="project-meta-field project-actual-cost">
                <label htmlFor="project-actual-cost">Kosto reale finale (€)</label>
                <p>Plotësoje kur projekti përfundon. Përdoret në raportin e fitimit real.</p>
                <input
                  id="project-actual-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={metaActualCost}
                  onChange={(e) => setMetaActualCost(e.target.value)}
                  placeholder="p.sh. 13 000"
                />
                <button
                  type="button"
                  className="project-report-link"
                  onClick={() => document.getElementById('price-analysis')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                >
                  <BarChart3 size={15} /> Shiko raportin e fitimit
                </button>
              </div>
              <label className="project-notes-field">
                Shënime mbi koston reale
                <input value={metaActualNotes} onChange={(e) => setMetaActualNotes(e.target.value)} placeholder="p.sh. rritje e materialit, ditë shtesë..." />
              </label>
            </div>
            <div className="project-meta-actions">
              <button type="button" className="primary-button" onClick={saveProjectMeta}>
                <Save size={16} /> Ruaj ndryshimet
              </button>
              <button type="button" className="card" onClick={analyzeSelectedProject}>
                <ClipboardCheck size={16} /> Analizo projektin
              </button>
              <button type="button" className="card project-delete-action" onClick={handleDeleteProject}>
                <Trash2 size={16} /> Fshi projektin
              </button>
            </div>
          </div>

          <div className="project-positions-toolbar">
            <div>
              <h3>Pozicionet e ofertës</h3>
              <p>Shfleto, redakto dhe krahaso pozicionet e këtij projekti.</p>
            </div>
            <div className="project-controls">
            <label>
              <span><Search size={14} /> Kërko pozicione</span>
              <input value={itemSearchTerm} onChange={(e) => setItemSearchTerm(e.target.value)} placeholder="Përshkrimi ose nr. pozicioni" />
            </label>
            <button type="button" className="card project-export-action" onClick={handleExport}>
              <Download size={16} /> Eksporto CSV
            </button>
            </div>
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
          <div className="panel-heading-row">
            <h3 className="panel-heading-accent">
              Kategoria: {selectedCategory.name} — {categoryItems.length} pozicione, {categoryGroups.length} projekte
            </h3>
            <button type="button" className="card import-cancel-btn" onClick={(e) => handleDeleteCategory(selectedCategory, e)}>
              Fshi kategorinë
            </button>
          </div>

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

      <PriceHistoryDashboard categories={categoriesList} refreshKey={analysisRefreshKey} />

      <section className="panel panel-top-gap revenue-trend-panel">
        <div className="revenue-trend-panel-header">
          <div>
            <span className="revenue-trend-eyebrow">Analiza e aktivitetit</span>
            <h3 className="panel-heading-accent">Vlera e ofertave sipas muajit</h3>
          </div>
          <span className="revenue-trend-period">6 muajt e fundit</span>
        </div>
        <RevenueTrendChart
          points={monthlyRevenueTrend}
          status={trendStatus}
          onStatusChange={setTrendStatus}
          loading={trendLoading}
          error={trendError}
        />
      </section>
    </Shell>
  );
}
