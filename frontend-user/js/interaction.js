/**
 * 交互管理器
 */
class InteractionManager {
    constructor(canvasManager) {
        this.canvasManager = canvasManager;
        this.renderer = canvasManager.getRenderer();
        this.btnToggleLight = null;
        this.btnBatchApply = null;
        this.pendingBatchApply = null;
        this.lastBatchResult = null;

        this.init();
    }

    init() {
        this.bindLensLibraryEvents();
        this.bindToolbarEvents();
        this.bindParamPanelEvents();
        this.bindFooterEvents();
        this.bindHelpEvents();
        this.bindLensSelectionEvents();
        this.bindBatchApplyEvents();
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

            // 重置透镜
            this.canvasManager.clear();

            // 重置光线状态
            this.renderer.setRunning(false);
            this.updateLightButtonState(false);

            // 批量套用结果一起清掉
            this.clearBatchResult();

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
                // 重置透镜后，之前的批量套用结果一并清除
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

        // 透镜新增/删除/清空（含触摸设备点击添加）时刷新批量套用按钮状态
        window.addEventListener('lensesChanged', (e) => {
            this.updateBatchApplyButtonState();

            // 透镜全部移除后，批量套用结果一并清除
            if (e.detail && e.detail.count === 0) {
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

    /* ================= 批量套用 ================= */

    /**
     * 绑定批量套用相关事件
     */
    bindBatchApplyEvents() {
        this.btnBatchApply = document.getElementById('btn-batch-apply');
        this.btnBatchApply.addEventListener('click', () => this.handleBatchApplyClick());

        document.getElementById('btn-batch-cancel').addEventListener('click', () => {
            this.hideBatchApplyModal();
        });

        document.getElementById('btn-batch-confirm').addEventListener('click', () => {
            this.confirmBatchApply();
        });

        document.getElementById('btn-batch-result-close').addEventListener('click', () => {
            this.clearBatchResult();
        });

        // 点击遮罩空白处关闭模态框
        document.getElementById('batch-apply-modal').addEventListener('click', (e) => {
            if (e.target.id === 'batch-apply-modal') {
                this.hideBatchApplyModal();
            }
        });

        this.updateBatchApplyButtonState();
    }

    /**
     * 更新批量套用按钮的启用/禁用状态
     * 画布上至少有两个透镜时才可用
     */
    updateBatchApplyButtonState() {
        if (!this.btnBatchApply) return;
        this.btnBatchApply.disabled = this.canvasManager.lenses.length < 2;
    }

    /**
     * 点击批量套用按钮
     */
    handleBatchApplyClick() {
        const sourceLens = this.canvasManager.selectedLens;

        if (!sourceLens) {
            Utils.showToast('请先点击画布上的透镜，选中要复制参数的透镜', 'warning');
            return;
        }

        if (this.canvasManager.lenses.length < 2) {
            Utils.showToast('画布上至少要有两个透镜才能批量套用', 'info');
            return;
        }

        this.showBatchApplyModal(sourceLens);
    }

    /**
     * 获取透镜在列表中的展示名称（编号 + 类型）
     */
    getLensLabel(lens) {
        const index = this.canvasManager.lenses.indexOf(lens);
        const number = index > -1 ? index + 1 : '?';
        return `透镜 ${number}（${lens.getTypeName()}）`;
    }

    /**
     * 获取材料中文名称
     */
    getMaterialName(materialId) {
        const names = {
            normal: '普通玻璃',
            highIndex: '高折射率镜片',
            lowDispersion: '低色散镜片'
        };
        return names[materialId] || materialId;
    }

    /**
     * 计算透镜与目标参数之间的差异明细
     */
    getLensParamChanges(lens, params) {
        const changes = [];

        if (Math.abs(lens.refractiveIndex - params.refractiveIndex) > 0.001) {
            changes.push(`折射率 ${lens.refractiveIndex.toFixed(2)} → ${params.refractiveIndex.toFixed(2)}`);
        }
        if (lens.size !== params.size) {
            changes.push(`尺寸 ${lens.size}% → ${params.size}%`);
        }
        if (lens.curvature !== params.curvature) {
            changes.push(`弧度 ${lens.curvature}% → ${params.curvature}%`);
        }
        if (lens.material !== params.material) {
            changes.push(`材料 ${lens.getMaterialName()} → ${this.getMaterialName(params.material)}`);
        }

        return changes;
    }

    /**
     * 构建批量套用预览：逐条列出会改动的透镜与会被跳过的透镜
     */
    buildBatchPreview(sourceLens) {
        const params = {
            refractiveIndex: sourceLens.refractiveIndex,
            size: sourceLens.size,
            curvature: sourceLens.curvature,
            material: sourceLens.material
        };

        const willApply = [];
        const willSkip = [];

        this.canvasManager.lenses.forEach(lens => {
            if (lens === sourceLens) {
                willSkip.push({ lens, reason: '当前选中的透镜（参数来源）' });
                return;
            }

            const changes = this.getLensParamChanges(lens, params);
            if (changes.length === 0) {
                willSkip.push({ lens, reason: '参数已完全相同，无需改动' });
            } else {
                willApply.push({ lens, changes });
            }
        });

        return { params, willApply, willSkip };
    }

    /**
     * 显示批量套用确认模态框
     */
    showBatchApplyModal(sourceLens) {
        const preview = this.buildBatchPreview(sourceLens);
        this.pendingBatchApply = preview;

        // 参数摘要
        document.getElementById('batch-params-summary').innerHTML = `
            <span>折射率 <strong>${preview.params.refractiveIndex.toFixed(2)}</strong></span>
            <span>尺寸 <strong>${preview.params.size}%</strong></span>
            <span>弧度 <strong>${preview.params.curvature}%</strong></span>
            <span>材料 <strong>${this.getMaterialName(preview.params.material)}</strong></span>
        `;

        // 会改动的透镜（逐条列出变化明细）
        const applyList = document.getElementById('batch-apply-list');
        document.getElementById('batch-apply-count').textContent = preview.willApply.length;
        if (preview.willApply.length > 0) {
            applyList.innerHTML = preview.willApply.map(item => `
                <li class="batch-lens-item">
                    <div class="batch-lens-name">${this.getLensLabel(item.lens)}</div>
                    <div class="batch-lens-changes">${item.changes.join('；')}</div>
                </li>
            `).join('');
        } else {
            applyList.innerHTML = '<li class="batch-empty-tip">没有需要改动的透镜</li>';
        }

        // 会被跳过的透镜（逐条列出跳过原因）
        const skipList = document.getElementById('batch-skip-list');
        document.getElementById('batch-skip-count').textContent = preview.willSkip.length;
        skipList.innerHTML = preview.willSkip.map(item => `
            <li class="batch-lens-item skipped">
                <div class="batch-lens-name">${this.getLensLabel(item.lens)}</div>
                <div class="batch-lens-reason">${item.reason}</div>
            </li>
        `).join('');

        // 没有可改动的透镜时禁用确认按钮
        document.getElementById('btn-batch-confirm').disabled = preview.willApply.length === 0;

        document.getElementById('batch-apply-modal').classList.remove('hidden');
    }

    /**
     * 隐藏批量套用模态框
     */
    hideBatchApplyModal() {
        document.getElementById('batch-apply-modal').classList.add('hidden');
        this.pendingBatchApply = null;
    }

    /**
     * 确认执行批量套用
     */
    confirmBatchApply() {
        const preview = this.pendingBatchApply;
        if (!preview || preview.willApply.length === 0) {
            this.hideBatchApplyModal();
            return;
        }

        const { params, willApply, willSkip } = preview;

        willApply.forEach(({ lens }) => {
            // 先应用材料（更新材料与色散系数），再覆盖其余参数
            lens.applyMaterial(params.material);
            lens.refractiveIndex = params.refractiveIndex;
            lens.size = params.size;
            lens.curvature = params.curvature;
        });

        this.hideBatchApplyModal();

        // 重新渲染光路
        this.renderer.render();

        // 套用完成后更新光线按钮状态与参数面板
        this.updateLightButtonState(this.renderer.isRunning);
        if (this.canvasManager.selectedLens) {
            this.updateParamPanel(this.canvasManager.selectedLens);
        }

        // 记录并展示批量套用结果
        this.lastBatchResult = {
            appliedCount: willApply.length,
            skippedCount: willSkip.length,
            timestamp: Date.now()
        };
        this.showBatchResult();

        Utils.showToast(`已套用到 ${willApply.length} 个透镜`, 'success');
    }

    /**
     * 在画布上显示最近一次批量套用的结果
     */
    showBatchResult() {
        const result = this.lastBatchResult;
        if (!result) return;

        document.getElementById('batch-result-text').textContent =
            `批量套用完成：${result.appliedCount} 个透镜已更新，${result.skippedCount} 个已跳过`;
        document.getElementById('batch-result-banner').classList.remove('hidden');
    }

    /**
     * 清除批量套用结果（重置透镜/重置画布时一并调用）
     */
    clearBatchResult() {
        this.lastBatchResult = null;
        const banner = document.getElementById('batch-result-banner');
        if (banner) {
            banner.classList.add('hidden');
        }
    }
}
