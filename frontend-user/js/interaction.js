/**
 * 交互管理器
 */
class InteractionManager {
    constructor(canvasManager) {
        this.canvasManager = canvasManager;
        this.renderer = canvasManager.getRenderer();
        this.btnToggleLight = null;
        this.btnBatchApply = null;
        this.batchModal = null;
        this.btnBatchConfirm = null;
        this.batchPlan = null;

        this.init();
    }

    init() {
        this.bindLensLibraryEvents();
        this.bindToolbarEvents();
        this.bindParamPanelEvents();
        this.bindBatchApplyEvents();
        this.bindFooterEvents();
        this.bindHelpEvents();
        this.bindLensSelectionEvents();
    }
    
    bindLensLibraryEvents() {
        const lensItems = document.querySelectorAll('.lens-item');
        
        lensItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                item.classList.add('dragging');
                e.dataTransfer.setData('lens-type', item.dataset.lensType);
                e.dataTransfer.setData('lens-material', item.dataset.material || '');
                e.dataTransfer.effectAllowed = 'copy';
            });
            
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });
            
            // 触摸设备点击添加
            if (Utils.isTouchDevice()) {
                item.addEventListener('click', () => {
                    const lens = new Lens({
                        type: item.dataset.lensType,
                        x: this.renderer.width / 2,
                        y: this.renderer.height / 2,
                        material: item.dataset.material || 'normal'
                    });
                    this.canvasManager.addLens(lens);
                    this.canvasManager.selectLens(lens);
                    Utils.showToast('透镜已添加', 'success');
                });
            }
        });
    }
    
    bindToolbarEvents() {
        // 启动/暂停光路
        this.btnToggleLight = document.getElementById('btn-toggle-light');
        this.btnToggleLight.addEventListener('click', () => {
            const isRunning = this.renderer.toggleRunning();
            this.updateLightButtonState(isRunning);
        });
        
        // 重置画布
        document.getElementById('btn-reset-canvas').addEventListener('click', () => {
            if (this.canvasManager.lenses.length === 0 && !this.renderer.isRunning) {
                Utils.showToast('画布已经是空的了', 'info');
                return;
            }

            // 关闭批量套用确认框（批量结果随 lensesChanged 事件一起清掉）
            this.closeBatchApplyModal();

            // 重置透镜
            this.canvasManager.clear();

            // 重置光线状态
            this.renderer.setRunning(false);
            this.updateLightButtonState(false);

            Utils.showToast('画布已重置', 'success');
        });
        
        // 光源模式选择
        document.getElementById('select-light-mode').addEventListener('change', (e) => {
            this.renderer.setLightMode(e.target.value);
            document.getElementById('data-light-type').textContent = 
                e.target.value === 'parallel' ? '平行光' : '点光源';
        });
        
        // 切换标注
        const btnToggleLabels = document.getElementById('btn-toggle-labels');
        btnToggleLabels.addEventListener('click', () => {
            const showLabels = this.renderer.toggleLabels();
            btnToggleLabels.classList.toggle('active', showLabels);
        });
    }
    
    /**
     * 更新光线按钮状态
     */
    updateLightButtonState(isRunning) {
        this.btnToggleLight.classList.toggle('active', isRunning);
        this.btnToggleLight.querySelector('span').textContent = isRunning ? '暂停光路' : '启动光路';
        
        const icon = this.btnToggleLight.querySelector('svg');
        if (isRunning) {
            icon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
        } else {
            icon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"/>';
        }
    }
    
    bindParamPanelEvents() {
        const riSlider = document.getElementById('param-ri');
        riSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('param-ri-value').textContent = value.toFixed(2);
            
            if (this.canvasManager.selectedLens) {
                this.canvasManager.selectedLens.refractiveIndex = value;
                this.renderer.render();
            }
        });
        
        const sizeSlider = document.getElementById('param-size');
        sizeSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('param-size-value').textContent = `${value}%`;
            
            if (this.canvasManager.selectedLens) {
                this.canvasManager.selectedLens.size = value;
                this.renderer.render();
            }
        });
        
        const curvatureSlider = document.getElementById('param-curvature');
        curvatureSlider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('param-curvature-value').textContent = `${value}%`;
            
            if (this.canvasManager.selectedLens) {
                this.canvasManager.selectedLens.curvature = value;
                this.renderer.render();
            }
        });
        
        document.getElementById('param-material').addEventListener('change', (e) => {
            if (this.canvasManager.selectedLens) {
                this.canvasManager.selectedLens.applyMaterial(e.target.value);
                riSlider.value = this.canvasManager.selectedLens.refractiveIndex;
                document.getElementById('param-ri-value').textContent = 
                    this.canvasManager.selectedLens.refractiveIndex.toFixed(2);
                this.renderer.render();
            }
        });
        
        document.getElementById('btn-reset-lens').addEventListener('click', () => {
            if (this.canvasManager.selectedLens) {
                this.canvasManager.selectedLens.reset();
                this.updateParamPanel(this.canvasManager.selectedLens);
                this.renderer.render();
                // 重置透镜后，之前的批量套用结果一并清掉
                this.clearBatchResult();
                Utils.showToast('参数已重置', 'success');
            }
        });
        
        document.getElementById('btn-delete-lens').addEventListener('click', () => {
            if (this.canvasManager.selectedLens) {
                this.canvasManager.removeLens(this.canvasManager.selectedLens);
                Utils.showToast('透镜已删除', 'success');
            }
        });
    }
    
    bindFooterEvents() {
        // 底部区域已简化，无需绑定事件
    }
    
    bindHelpEvents() {
        document.getElementById('btn-help').addEventListener('click', () => {
            Storage.resetGuide();
            window.dispatchEvent(new CustomEvent('showGuide'));
        });
        
        document.querySelectorAll('.btn-help-small').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                Utils.showHelpTooltip(btn, btn.dataset.help);
            });
            btn.addEventListener('mouseleave', () => {
                Utils.hideHelpTooltip();
            });
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                Utils.showHelpTooltip(btn, btn.dataset.help);
                setTimeout(() => Utils.hideHelpTooltip(), 3000);
            });
        });
    }
    
    bindLensSelectionEvents() {
        window.addEventListener('lensSelected', (e) => {
            this.showParamPanel(e.detail);
            this.updateBatchApplyButtonState();
        });

        window.addEventListener('lensDeselected', () => {
            this.hideParamPanel();
            this.updateBatchApplyButtonState();
        });

        // 透镜数量变化（添加/删除/清空，含触摸设备点击添加）
        window.addEventListener('lensesChanged', (e) => {
            this.updateBatchApplyButtonState();

            // 画布被清空时，批量套用结果一起清掉
            if (e.detail.count === 0) {
                this.clearBatchResult();
            }
        });
    }
    
    showParamPanel(lens) {
        document.getElementById('panel-empty').classList.add('hidden');
        document.getElementById('panel-params').classList.remove('hidden');
        this.updateParamPanel(lens);
    }
    
    hideParamPanel() {
        document.getElementById('panel-empty').classList.remove('hidden');
        document.getElementById('panel-params').classList.add('hidden');
    }
    
    updateParamPanel(lens) {
        document.getElementById('param-type-value').textContent = lens.getTypeName();
        document.getElementById('param-ri').value = lens.refractiveIndex;
        document.getElementById('param-ri-value').textContent = lens.refractiveIndex.toFixed(2);
        document.getElementById('param-size').value = lens.size;
        document.getElementById('param-size-value').textContent = `${lens.size}%`;
        document.getElementById('param-curvature').value = lens.curvature;
        document.getElementById('param-curvature-value').textContent = `${lens.curvature}%`;
        document.getElementById('param-material').value = lens.material;
        
        const curvatureGroup = document.getElementById('param-curvature-group');
        curvatureGroup.style.display = lens.type === CONFIG.LENS_TYPES.PLANO ? 'none' : 'flex';
    }

    /* ========== 参数批量套用 ========== */

    /**
     * 绑定批量套用相关事件
     */
    bindBatchApplyEvents() {
        this.btnBatchApply = document.getElementById('btn-batch-apply');
        this.batchModal = document.getElementById('batch-apply-modal');
        this.btnBatchConfirm = document.getElementById('btn-batch-confirm');

        this.btnBatchApply.addEventListener('click', () => {
            this.openBatchApplyModal();
        });

        document.getElementById('btn-batch-cancel').addEventListener('click', () => {
            this.closeBatchApplyModal();
        });

        this.btnBatchConfirm.addEventListener('click', () => {
            this.confirmBatchApply();
        });

        document.getElementById('btn-batch-clear').addEventListener('click', () => {
            this.clearBatchResult();
            Utils.showToast('批量套用结果已清除', 'info');
        });

        // 点击遮罩空白处关闭确认框
        this.batchModal.addEventListener('click', (e) => {
            if (e.target === this.batchModal) {
                this.closeBatchApplyModal();
            }
        });

        this.updateBatchApplyButtonState();
    }

    /**
     * 更新批量套用按钮的启用/禁用状态
     * 画布上至少有两个透镜时才可用（触摸设备点击添加的透镜同样计入）
     */
    updateBatchApplyButtonState() {
        if (!this.btnBatchApply) return;
        this.btnBatchApply.disabled = this.canvasManager.lenses.length < 2;
    }

    /**
     * 获取透镜在列表中的显示名称
     */
    getLensLabel(lens) {
        const index = this.canvasManager.lenses.indexOf(lens);
        return `${lens.getTypeName()} #${index + 1}`;
    }

    /**
     * 对比源透镜与目标透镜的参数差异
     */
    getParamDiffs(source, target) {
        const diffs = [];

        if (Math.abs(target.refractiveIndex - source.refractiveIndex) > 0.001) {
            diffs.push({
                name: '折射率',
                from: target.refractiveIndex.toFixed(2),
                to: source.refractiveIndex.toFixed(2)
            });
        }

        if (target.size !== source.size) {
            diffs.push({ name: '尺寸', from: `${target.size}%`, to: `${source.size}%` });
        }

        if (target.curvature !== source.curvature) {
            diffs.push({ name: '弧度', from: `${target.curvature}%`, to: `${source.curvature}%` });
        }

        if (target.material !== source.material) {
            diffs.push({ name: '材料', from: target.getMaterialName(), to: source.getMaterialName() });
        }

        return diffs;
    }

    /**
     * 构建批量套用计划：逐条分出会改动的透镜与会被跳过的透镜
     */
    buildBatchPlan(source) {
        const changed = [];
        const skipped = [];

        this.canvasManager.lenses.forEach(lens => {
            const label = this.getLensLabel(lens);

            if (lens === source) {
                skipped.push({ lens, label, reason: '参数来源（源透镜）' });
                return;
            }

            const diffs = this.getParamDiffs(source, lens);

            if (diffs.length > 0) {
                changed.push({ lens, label, diffs });
            } else {
                skipped.push({ lens, label, reason: '参数已相同，无需改动' });
            }
        });

        return { changed, skipped };
    }

    /**
     * 打开批量套用确认框
     */
    openBatchApplyModal() {
        if (this.canvasManager.lenses.length < 2) {
            Utils.showToast('画布上至少需要两个透镜才能批量套用', 'info');
            return;
        }

        const source = this.canvasManager.selectedLens;

        // 没有选中透镜时给出提示
        if (!source) {
            Utils.showToast('请先点击画布上的透镜，选择参数来源', 'warning');
            return;
        }

        this.batchPlan = this.buildBatchPlan(source);
        this.renderBatchPlan(source, this.batchPlan);
        this.batchModal.classList.remove('hidden');
    }

    /**
     * 关闭批量套用确认框
     */
    closeBatchApplyModal() {
        if (this.batchModal) {
            this.batchModal.classList.add('hidden');
        }
    }

    /**
     * 渲染确认框内容：源参数摘要 + 改动/跳过透镜清单
     */
    renderBatchPlan(source, plan) {
        // 源透镜参数摘要
        document.getElementById('batch-source-params').innerHTML = `
            <div class="batch-source-title">将「${this.getLensLabel(source)}」的参数套用到其他透镜</div>
            <div class="batch-source-chips">
                <span class="batch-param-chip">折射率 ${source.refractiveIndex.toFixed(2)}</span>
                <span class="batch-param-chip">尺寸 ${source.size}%</span>
                <span class="batch-param-chip">弧度 ${source.curvature}%</span>
                <span class="batch-param-chip">${source.getMaterialName()}</span>
            </div>
        `;

        // 会改动的透镜
        const changedListEl = document.getElementById('batch-changed-list');
        document.getElementById('batch-changed-count').textContent = `(${plan.changed.length})`;

        if (plan.changed.length > 0) {
            changedListEl.innerHTML = plan.changed.map(item => `
                <div class="batch-lens-item changed">
                    <div class="batch-lens-header">
                        <span class="batch-lens-name">${item.label}</span>
                        <span class="batch-lens-status status-changed">将改动</span>
                    </div>
                    <div class="batch-lens-diffs">
                        ${item.diffs.map(d => `
                            <div class="batch-diff">${d.name}：${d.from} → <span class="diff-to">${d.to}</span></div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
        } else {
            changedListEl.innerHTML = '<div class="batch-empty">没有需要改动的透镜</div>';
        }

        // 会被跳过的透镜
        const skippedListEl = document.getElementById('batch-skipped-list');
        document.getElementById('batch-skipped-count').textContent = `(${plan.skipped.length})`;

        skippedListEl.innerHTML = plan.skipped.map(item => `
            <div class="batch-lens-item skipped">
                <div class="batch-lens-header">
                    <span class="batch-lens-name">${item.label}</span>
                    <span class="batch-lens-status status-skipped">跳过</span>
                </div>
                <div class="batch-lens-reason">${item.reason}</div>
            </div>
        `).join('');

        // 没有可改动的透镜时禁用确认按钮
        this.btnBatchConfirm.disabled = plan.changed.length === 0;
    }

    /**
     * 确认批量套用
     */
    confirmBatchApply() {
        const source = this.canvasManager.selectedLens;

        if (!source || !this.batchPlan) {
            this.closeBatchApplyModal();
            return;
        }

        // 逐个套用参数
        this.batchPlan.changed.forEach(item => {
            this.applyParamsToLens(item.lens, source);
        });

        this.renderer.render();

        // 套用完成后更新光线按钮状态与参数面板
        this.updateLightButtonState(this.renderer.isRunning);
        this.updateParamPanel(source);

        // 在参数面板展示本次批量套用结果
        this.showBatchResult(this.batchPlan);

        const changedCount = this.batchPlan.changed.length;
        const skippedCount = this.batchPlan.skipped.length;

        this.closeBatchApplyModal();

        Utils.showToast(`批量套用完成：改动 ${changedCount} 个，跳过 ${skippedCount} 个`, 'success');
    }

    /**
     * 把源透镜的参数套用到目标透镜
     */
    applyParamsToLens(lens, source) {
        // 先应用材料（更新色散系数），再覆盖折射率
        lens.applyMaterial(source.material);
        lens.refractiveIndex = source.refractiveIndex;
        lens.size = source.size;
        lens.curvature = source.curvature;
    }

    /**
     * 在参数面板展示批量套用结果
     */
    showBatchResult(plan) {
        const resultEl = document.getElementById('batch-result');
        const listEl = document.getElementById('batch-result-list');

        const items = [
            ...plan.changed.map(item => ({
                type: 'changed',
                text: `${item.label}：已更新 ${item.diffs.length} 项参数`
            })),
            ...plan.skipped.map(item => ({
                type: 'skipped',
                text: `${item.label}：已跳过（${item.reason}）`
            }))
        ];

        listEl.innerHTML = items.map(item =>
            `<div class="batch-result-item ${item.type}">${item.text}</div>`
        ).join('');

        resultEl.classList.remove('hidden');
    }

    /**
     * 清除批量套用结果
     */
    clearBatchResult() {
        const resultEl = document.getElementById('batch-result');
        if (resultEl) {
            resultEl.classList.add('hidden');
        }

        const listEl = document.getElementById('batch-result-list');
        if (listEl) {
            listEl.innerHTML = '';
        }

        this.batchPlan = null;
    }
}
