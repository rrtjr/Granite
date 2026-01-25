// Granite Frontend - Graph View Module

import { Debug } from './config.js';

export const graphMixin = {
    // Initialize the graph visualization
    async initGraph() {
        if (typeof vis === 'undefined') {
            Debug.error('vis-network library not loaded');
            return;
        }

        this.graphLoaded = false;

        try {
            const response = await fetch('/api/graph');
            if (!response.ok) throw new Error('Failed to fetch graph data');
            const data = await response.json();
            this.graphData = data;

            const container = document.getElementById('graph-overlay');
            if (!container) return;

            // Force reflow to ensure CSS is applied
            document.body.offsetHeight;
            const style = getComputedStyle(document.documentElement);

            const getCssVar = (name, fallback) => {
                const value = style.getPropertyValue(name).trim();
                return value || fallback;
            };

            const accentPrimary = getCssVar('--accent-primary', '#7c3aed');
            const accentSecondary = getCssVar('--accent-secondary', '#a78bfa');
            const textPrimary = getCssVar('--text-primary', '#111827');
            const textSecondary = getCssVar('--text-secondary', '#6b7280');
            const borderColor = getCssVar('--border-primary', '#e5e7eb');

            // Prepare nodes
            const nodes = new vis.DataSet(data.nodes.map(n => ({
                id: n.id,
                label: n.label,
                title: n.id,
                color: {
                    background: accentPrimary,
                    border: accentPrimary,
                    highlight: {
                        background: accentPrimary,
                        border: textPrimary
                    },
                    hover: {
                        background: accentSecondary,
                        border: accentPrimary
                    }
                },
                font: {
                    color: textPrimary,
                    size: 12,
                    face: 'system-ui, -apple-system, sans-serif'
                },
                borderWidth: this.currentNote === n.id ? 4 : 2,
                chosen: {
                    node: (values) => {
                        values.size = 22;
                        values.borderWidth = 4;
                        values.borderColor = textPrimary;
                    }
                }
            })));

            // Prepare edges
            const edges = new vis.DataSet(data.edges.map((e, i) => ({
                id: i,
                from: e.source,
                to: e.target,
                color: {
                    color: e.type === 'wikilink' ? accentPrimary : borderColor,
                    highlight: accentPrimary,
                    hover: accentSecondary,
                    opacity: 0.8
                },
                width: e.type === 'wikilink' ? 2 : 1,
                smooth: {
                    type: 'continuous',
                    roundness: 0.5
                },
                chosen: {
                    edge: (values) => {
                        values.width = 3;
                        values.color = accentPrimary;
                    }
                }
            })));

            // Network options
            const options = {
                nodes: {
                    shape: 'dot',
                    size: 16,
                    borderWidth: 2,
                    shadow: {
                        enabled: true,
                        color: 'rgba(0,0,0,0.1)',
                        size: 5,
                        x: 2,
                        y: 2
                    }
                },
                edges: {
                    arrows: {
                        to: {
                            enabled: true,
                            scaleFactor: 0.5,
                            type: 'arrow'
                        }
                    }
                },
                physics: {
                    enabled: true,
                    solver: 'forceAtlas2Based',
                    forceAtlas2Based: {
                        gravitationalConstant: -50,
                        centralGravity: 0.01,
                        springLength: 100,
                        springConstant: 0.08,
                        damping: 0.4,
                        avoidOverlap: 0.5
                    },
                    stabilization: {
                        enabled: true,
                        iterations: 200,
                        updateInterval: 25
                    }
                },
                interaction: {
                    hover: true,
                    tooltipDelay: 200,
                    navigationButtons: false,
                    keyboard: {
                        enabled: true,
                        bindToWindow: false
                    },
                    zoomView: true,
                    dragView: true
                },
                layout: {
                    improvedLayout: true,
                    randomSeed: 42
                }
            };

            // Destroy existing instance
            if (this.graphInstance) {
                this.graphInstance.destroy();
                this.graphInstance = null;
            }

            // Clear container
            const graphCanvas = container.querySelector('canvas');
            if (graphCanvas) graphCanvas.remove();
            const visElements = container.querySelectorAll('.vis-network, .vis-navigation');
            visElements.forEach(el => el.remove());

            // Create the network
            this.graphInstance = new vis.Network(container, { nodes, edges }, options);

            const graphRef = this.graphInstance;
            const currentNoteRef = this.currentNote;

            // Wait for stabilization
            this.graphInstance.once('stabilizationIterationsDone', () => {
                graphRef.setOptions({ physics: { enabled: false } });
                this.graphLoaded = true;

                if (currentNoteRef) {
                    setTimeout(() => {
                        try {
                            if (graphRef && this.showGraph) {
                                const nodeIds = graphRef.body.data.nodes.getIds();
                                if (nodeIds.includes(currentNoteRef)) {
                                    graphRef.focus(currentNoteRef, {
                                        scale: 1.2,
                                        animation: {
                                            duration: 500,
                                            easingFunction: 'easeInOutQuad'
                                        }
                                    });
                                    graphRef.selectNodes([currentNoteRef]);
                                }
                            }
                        } catch (e) {
                            // Ignore - graph may have been destroyed
                        }
                    }, 150);
                }
            });

            // Click event - open note
            this.graphInstance.on('click', (params) => {
                if (params.nodes.length > 0) {
                    const noteId = params.nodes[0];
                    this.loadNote(noteId);
                }
            });

            // Double-click event - open note and close graph
            this.graphInstance.on('doubleClick', (params) => {
                if (params.nodes.length > 0) {
                    const noteId = params.nodes[0];
                    this.showGraph = false;
                    this.loadNote(noteId);
                }
            });

            // Hover event - highlight connections
            this.graphInstance.on('hoverNode', (params) => {
                const nodeId = params.node;
                const connectedNodes = this.graphInstance.getConnectedNodes(nodeId);

                const allNodes = nodes.getIds();
                const updates = allNodes.map(id => ({
                    id,
                    opacity: (id === nodeId || connectedNodes.includes(id)) ? 1 : 0.2
                }));
                nodes.update(updates);
            });

            this.graphInstance.on('blurNode', () => {
                const allNodes = nodes.getIds();
                const updates = allNodes.map(id => ({ id, opacity: 1 }));
                nodes.update(updates);
            });

            // Add legend
            this.addGraphLegend(container, accentPrimary, borderColor, textSecondary);

        } catch (error) {
            Debug.error('Failed to initialize graph:', error);
            this.graphLoaded = true;
        }
    },

    // Add legend to graph container
    addGraphLegend(container, wikiColor, mdColor, textColor) {
        const existingLegend = container.querySelector('.graph-legend');
        if (existingLegend) existingLegend.remove();

        const legend = document.createElement('div');
        legend.className = 'graph-legend';
        legend.innerHTML = `
            <div class="graph-legend-item">
                <span class="graph-legend-dot" style="background: ${wikiColor};"></span>
                <span style="color: ${textColor};">Wikilinks</span>
            </div>
            <div class="graph-legend-item">
                <span class="graph-legend-dot" style="background: ${mdColor};"></span>
                <span style="color: ${textColor};">Markdown links</span>
            </div>
            <div style="margin-top: 8px; font-size: 10px; color: ${textColor}; opacity: 0.7;">
                Click: select • Double-click: open
            </div>
        `;
        container.appendChild(legend);
    },

    // Refresh graph when theme changes
    refreshGraph() {
        if (this.viewMode === 'graph' && this.graphInstance) {
            this.initGraph();
        }
    },

    // Graph navigation methods
    graphZoomIn() {
        if (this.graphInstance) {
            const scale = this.graphInstance.getScale();
            this.graphInstance.moveTo({ scale: scale * 1.3 });
        }
    },

    graphZoomOut() {
        if (this.graphInstance) {
            const scale = this.graphInstance.getScale();
            this.graphInstance.moveTo({ scale: scale / 1.3 });
        }
    },

    graphFit() {
        if (this.graphInstance) {
            this.graphInstance.fit({
                animation: {
                    duration: 500,
                    easingFunction: 'easeInOutQuad'
                }
            });
        }
    },
};
