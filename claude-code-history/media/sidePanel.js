// @ts-nocheck
/* Claude History Viewer - Side Panel Frontend */
(function () {
  const vscode = acquireVsCodeApi();

  // State
  let currentView = 'list'; // 'list' | 'detail' | 'search'
  let allSessions = [];
  let currentProject = '';
  let currentDetail = null;
  let activeTab = 'conversation';
  let searchTimeout = null;

  // DOM elements
  const $ = (id) => document.getElementById(id);
  const backBtn = $('backBtn');
  const headerTitle = $('headerTitle');
  const refreshBtn = $('refreshBtn');
  const resumeDetailBtn = $('resumeDetailBtn');
  const copyResumeDetailBtn = $('copyResumeDetailBtn');
  const tabBar = $('tabBar');
  const searchInput = $('searchInput');
  const projectSelect = $('projectSelect');
  const loading = $('loading');
  const errorMsg = $('errorMsg');
  const sessionList = $('sessionList');
  const sessionDetail = $('sessionDetail');
  const conversationView = $('conversationView');
  const fileChangesView = $('fileChangesView');
  const searchResults = $('searchResults');
  const emptyState = $('emptyState');
  const projectFilter = $('projectFilter');

  // Event listeners
  backBtn.addEventListener('click', showListView);
  refreshBtn.addEventListener('click', () => vscode.postMessage({ command: 'refresh' }));
  resumeDetailBtn.addEventListener('click', () => {
    if (currentDetail?.session?.sessionId) {
      vscode.postMessage({ command: 'resumeSession', sessionId: currentDetail.session.sessionId, cwd: currentDetail.session.cwd });
    }
  });
  copyResumeDetailBtn.addEventListener('click', () => {
    if (currentDetail?.session?.sessionId) {
      vscode.postMessage({
        command: 'copyResumeCommand',
        sessionId: currentDetail.session.sessionId,
        cwd: currentDetail.session.cwd,
        projectPath: currentDetail.session.projectPath,
      });
    }
  });

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const q = searchInput.value.trim();
    if (!q) { showListView(); return; }
    searchTimeout = setTimeout(() => {
      if (q.length >= 2) {
        vscode.postMessage({ command: 'search', query: q });
      }
    }, 300);
  });

  projectSelect.addEventListener('change', () => {
    currentProject = projectSelect.value;
    renderSessions();
  });

  // Tab switching
  tabBar.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      tabBar.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (activeTab === 'conversation') {
        conversationView.classList.remove('hidden');
        fileChangesView.classList.add('hidden');
      } else {
        conversationView.classList.add('hidden');
        fileChangesView.classList.remove('hidden');
      }
    });
  });

  // Message handler from extension
  window.addEventListener('message', (e) => {
    const msg = e.data;
    switch (msg.command) {
      case 'sessionsLoaded': handleSessionsLoaded(msg); break;
      case 'sessionDetailLoaded': handleDetailLoaded(msg); break;
      case 'searchResults': handleSearchResults(msg); break;
      case 'projectsLoaded': handleProjectsLoaded(msg); break;
      case 'error': showError(msg.message); break;
      case 'loading': toggleLoading(msg.loading); break;
    }
  });

  function handleSessionsLoaded(msg) {
    allSessions = msg.sessions || [];
    // 默认不自动选中当前项目，保持 All Projects
    populateProjectFilter();
    renderSessions();
  }

  function handleDetailLoaded(msg) {
    currentDetail = msg.detail;
    showDetailView();
    renderDetail();
  }

  function handleSearchResults(msg) {
    showSearchView();
    renderSearchResults(msg.results);
  }

  function handleProjectsLoaded(msg) {
    populateProjectFilterWithList(msg.projects, msg.currentProject);
  }

  // Views
  function showListView() {
    currentView = 'list';
    backBtn.classList.add('hidden');
    resumeDetailBtn.classList.add('hidden');
    copyResumeDetailBtn.classList.add('hidden');
    headerTitle.textContent = 'Claude History';
    tabBar.classList.add('hidden');
    sessionList.classList.remove('hidden');
    sessionDetail.classList.add('hidden');
    searchResults.classList.add('hidden');
    searchInput.parentElement.classList.remove('hidden');
    projectFilter.classList.remove('hidden');
    emptyState.classList.add('hidden');
    errorMsg.classList.add('hidden');
  }

  function showDetailView() {
    currentView = 'detail';
    backBtn.classList.remove('hidden');
    resumeDetailBtn.classList.remove('hidden');
    copyResumeDetailBtn.classList.remove('hidden');
    headerTitle.textContent = currentDetail?.session?.title || 'Session Detail';
    tabBar.classList.remove('hidden');
    sessionList.classList.add('hidden');
    sessionDetail.classList.remove('hidden');
    searchResults.classList.add('hidden');
    searchInput.parentElement.classList.add('hidden');
    projectFilter.classList.add('hidden');
    emptyState.classList.add('hidden');
    errorMsg.classList.add('hidden');
    // Reset to conversation tab
    activeTab = 'conversation';
    tabBar.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tabBar.querySelector('[data-tab="conversation"]').classList.add('active');
    conversationView.classList.remove('hidden');
    fileChangesView.classList.add('hidden');
  }

  function showSearchView() {
    currentView = 'search';
    backBtn.classList.remove('hidden');
    headerTitle.textContent = 'Search Results';
    tabBar.classList.add('hidden');
    sessionList.classList.add('hidden');
    sessionDetail.classList.add('hidden');
    searchResults.classList.remove('hidden');
    emptyState.classList.add('hidden');
    errorMsg.classList.add('hidden');
  }

  function toggleLoading(show) {
    loading.classList.toggle('hidden', !show);
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
  }

  // Render sessions
  function renderSessions() {
    let filtered = allSessions;
    if (currentProject) {
      filtered = filtered.filter(s => s.projectPath === currentProject);
    }

    if (filtered.length === 0) {
      sessionList.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    // Group by date
    const groups = groupByDate(filtered);
    let html = '';
    for (const [label, sessions] of groups) {
      html += `<div class="date-group"><div class="date-label">${esc(label)}</div>`;
      for (const s of sessions) {
        const time = formatTime(s.startTime || s.endTime);
        const project = decodeProjectName(s.projectPath);
        html += `<div class="session-item" data-filepath="${esc(s.filePath)}">
          <div class="session-title">${esc(s.title)}</div>
          <div class="session-meta">
            <span>${time}</span>
            <span>${s.messageCount} msgs</span>
          </div>
          <div class="session-project">${esc(project)}</div>
          <div class="session-actions">
            <button class="resume-btn" data-session-id="${esc(s.sessionId)}" data-cwd="${esc(s.cwd || '')}"
              title="Resume this session in terminal">▶ Resume</button>
            <button class="copy-resume-btn" data-session-id="${esc(s.sessionId)}" data-cwd="${esc(s.cwd || '')}" data-project="${esc(s.projectPath || '')}"
              title="Copy resume command to clipboard">📋 Copy</button>
          </div>
        </div>`;
      }
      html += '</div>';
    }
    sessionList.innerHTML = html;

    // Click handlers
    sessionList.querySelectorAll('.session-item').forEach(el => {
      el.addEventListener('click', () => {
        const fp = el.dataset.filepath;
        vscode.postMessage({ command: 'getSessionDetail', filePath: fp });
      });
    });

    // Resume button click handlers
    sessionList.querySelectorAll('.resume-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const sessionId = btn.dataset.sessionId;
        const cwd = btn.dataset.cwd;
        vscode.postMessage({ command: 'resumeSession', sessionId, cwd });
      });
    });

    // Copy resume command button click handlers
    sessionList.querySelectorAll('.copy-resume-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        vscode.postMessage({
          command: 'copyResumeCommand',
          sessionId: btn.dataset.sessionId,
          cwd: btn.dataset.cwd,
          projectPath: btn.dataset.project,
        });
      });
    });
  }

  // Render detail
  function renderDetail() {
    if (!currentDetail) return;
    renderConversation(currentDetail.messages);
    renderFileChanges(currentDetail.fileChanges);
  }

  function renderConversation(messages) {
    let html = '';
    for (const msg of messages) {
      const isHuman = msg.type === 'human' || msg.type === 'user';
      const roleClass = isHuman ? 'human' : 'assistant';
      const roleIcon = isHuman ? '👤' : '🤖';
      const roleName = isHuman ? 'You' : 'Claude';

      html += `<div class="message ${roleClass}">
        <div class="message-role">
          <span class="role-icon">${roleIcon}</span>
          <span class="role-${roleClass}">${roleName}</span>
        </div>
        <div class="message-content">${renderContent(msg.message?.content)}</div>
      </div>`;
    }
    conversationView.innerHTML = html;

    // Setup thinking toggles
    conversationView.querySelectorAll('.thinking-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('open');
        const content = btn.nextElementSibling;
        content.classList.toggle('hidden');
      });
    });
  }

  function renderContent(content) {
    if (!content) return '';
    if (typeof content === 'string') return renderMarkdown(content);
    if (!Array.isArray(content)) return '';

    let html = '';
    for (const block of content) {
      if (!block) continue;
      switch (block.type) {
        case 'text':
          html += renderMarkdown(block.text || '');
          break;
        case 'thinking':
          html += renderThinking(block.thinking || '');
          break;
        case 'tool_use':
          html += renderToolUse(block);
          break;
        case 'tool_result':
          html += renderToolResult(block);
          break;
        default:
          if (block.text) html += renderMarkdown(block.text);
          break;
      }
    }
    return html;
  }

  function renderMarkdown(text) {
    if (!text) return '';
    // Simple markdown rendering
    let html = esc(text);

    // Code blocks with language
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang}">${code}</code></pre>`
    );
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Line breaks
    html = html.replace(/\n/g, '<br>');

    return html;
  }

  function renderThinking(text) {
    const preview = text.substring(0, 100).replace(/\n/g, ' ');
    return `<div class="thinking-block">
      <button class="thinking-toggle">
        <span class="arrow">▶</span>
        <span>💭 Thinking: ${esc(preview)}${text.length > 100 ? '...' : ''}</span>
      </button>
      <div class="thinking-content hidden">${renderMarkdown(text)}</div>
    </div>`;
  }

  function renderToolUse(block) {
    const name = block.name || 'Unknown';
    const input = block.input || {};
    let body = '';

    if (name === 'Read' && input.file_path) {
      body = `<div style="color:var(--text-secondary)">📖 ${esc(String(input.file_path))}</div>`;
    } else if (name === 'Write' && input.file_path) {
      body = `<div style="color:var(--success)">✏️ ${esc(String(input.file_path))}</div>`;
      if (input.content) {
        const preview = String(input.content).substring(0, 200);
        body += `<pre style="margin-top:4px;font-size:11px;max-height:100px;overflow:auto">${esc(preview)}${String(input.content).length > 200 ? '...' : ''}</pre>`;
      }
    } else if ((name === 'Edit' || name === 'MultiEdit') && input.file_path) {
      body = `<div style="color:var(--warning)">🔧 ${esc(String(input.file_path))}</div>`;
    } else if (name === 'Bash' || name === 'bash') {
      const cmd = input.command || input.cmd || '';
      body = `<pre style="font-size:11px">${esc(String(cmd))}</pre>`;
    } else {
      body = `<pre style="font-size:11px;max-height:100px;overflow:auto">${esc(JSON.stringify(input, null, 2))}</pre>`;
    }

    return `<div class="tool-block">
      <div class="tool-header">
        <span class="tool-icon">🔧</span>
        <span>${esc(name)}</span>
      </div>
      <div class="tool-body">${body}</div>
    </div>`;
  }

  function renderToolResult(block) {
    const content = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
    if (!content || content.length < 5) return '';
    const preview = content.substring(0, 500);
    return `<div class="tool-result">${esc(preview)}${content.length > 500 ? '...' : ''}</div>`;
  }

  function renderFileChanges(fileChanges) {
    if (!fileChanges || fileChanges.length === 0) {
      fileChangesView.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">No file changes in this session</div>';
      return;
    }

    let html = '';
    for (const fc of fileChanges) {
      const fileName = fc.filePath.split('/').pop() || fc.filePath;
      const dir = fc.filePath.substring(0, fc.filePath.length - fileName.length);
      const opIcon = fc.operation === 'write' || fc.operation === 'create' ? '🆕' :
                     fc.operation === 'edit' ? '✏️' : fc.operation === 'multi_edit' ? '📝' : '📄';

      html += `<div class="file-change-item" data-index="${fileChanges.indexOf(fc)}">
        <span class="file-change-icon">${opIcon}</span>
        <div class="file-change-info">
          <div class="file-change-name">${esc(fileName)}</div>
          <div class="file-change-path">${esc(dir)}</div>
        </div>
        <div class="file-change-stats">
          <span class="stat-add">+${fc.totalAdditions || 0}</span>
          <span class="stat-del">-${fc.totalDeletions || 0}</span>
        </div>
        <div class="file-change-actions">
          <button class="file-action-btn diff-btn" title="View Diff">Diff</button>
        </div>
      </div>`;
    }
    fileChangesView.innerHTML = html;

    // Click handlers
    fileChangesView.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const item = btn.closest('.file-change-item');
        const idx = parseInt(item.dataset.index || '0');
        const fc = fileChanges[idx];
        if (fc) {
          vscode.postMessage({ command: 'showDiff', fileChange: fc });
        }
      });
    });

    fileChangesView.querySelectorAll('.file-change-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.index || '0');
        const fc = fileChanges[idx];
        if (fc) {
          vscode.postMessage({ command: 'showDiff', fileChange: fc });
        }
      });
    });
  }

  // Search results
  function renderSearchResults(results) {
    if (!results || results.length === 0) {
      searchResults.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">No results found</div>';
      return;
    }

    let html = '';
    for (const r of results) {
      html += `<div class="search-result-item" data-session="${esc(r.sessionId)}">
        <div class="search-session-title">${esc(r.sessionTitle)}</div>
        <div class="search-match-text">${esc(r.matchedText)}</div>
      </div>`;
    }
    searchResults.innerHTML = html;
  }

  // Helper: populate project filter
  function populateProjectFilter() {
    const projects = [...new Set(allSessions.map(s => s.projectPath).filter(Boolean))];
    populateProjectFilterWithList(projects, currentProject);
  }

  function populateProjectFilterWithList(projects, current) {
    let html = '<option value="">All Projects</option>';
    for (const p of projects) {
      const name = decodeProjectName(p);
      const selected = p === current ? ' selected' : '';
      html += `<option value="${esc(p)}"${selected}>${esc(name)}</option>`;
    }
    projectSelect.innerHTML = html;
    if (current) projectSelect.value = current;
  }

  // Helper: group sessions by date
  function groupByDate(sessions) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const thisWeek = new Date(today); thisWeek.setDate(today.getDate() - 7);

    const groups = new Map();
    for (const s of sessions) {
      const d = new Date(s.endTime || s.startTime);
      let label;
      if (d >= today) label = 'Today';
      else if (d >= yesterday) label = 'Yesterday';
      else if (d >= thisWeek) label = 'This Week';
      else label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(s);
    }
    return groups;
  }

  // Helper: decode project name
  function decodeProjectName(encoded) {
    if (!encoded) return 'Unknown';
    const decoded = encoded.startsWith('-')
      ? '/' + encoded.substring(1).replace(/-/g, '/')
      : encoded.replace(/-/g, '/');
    const parts = decoded.split('/').filter(Boolean);
    return parts[parts.length - 1] || decoded;
  }

  // Helper: format time
  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  // Helper: escape HTML
  function esc(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = String(s);
    return div.innerHTML;
  }

  // Initialize
  vscode.postMessage({ command: 'getSessions' });
})();
