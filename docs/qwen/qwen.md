> ## Documentation Index
> Fetch the complete documentation index at: https://docs.bailian.console.aliyun.com/llms.txt
> Use this file to discover all available pages before exploring further.

# 获取与配置 API Key

> 在控制台获取或创建 API Key 后，您将使用它来安全地调用百炼的模型服务。

<meta property="og:title" content="获取与配置 API Key" />

<style>/\* Native RKB assistant entry; keep surrounding document spacing in the theme. \*/ .rkb-ask-ai \{   --rkb-ask-ai-ink: var(--adoc-color-text, #24272e);   --rkb-ask-ai-muted: var(--adoc-color-text-secondary, #616672);   --rkb-ask-ai-accent: var(--adoc-color-primary, #2563eb);   --rkb-ask-ai-surface: color-mix(in srgb, var(--rkb-ask-ai-accent) 3%, var(--adoc-color-bg, #fff));   --rkb-ask-ai-item: var(--adoc-color-bg, #fff);   --rkb-ask-ai-border: var(--adoc-color-border, #e2e5ea);   --rkb-ask-ai-label-ink: color-mix(in srgb, var(--rkb-ask-ai-accent) 80%, var(--rkb-ask-ai-ink));   --rkb-ask-ai-label-surface: color-mix(in srgb, var(--rkb-ask-ai-accent) 9%, var(--adoc-color-bg, #fff));   --rkb-ask-ai-hover-surface: color-mix(in srgb, var(--rkb-ask-ai-accent) 2%, var(--rkb-ask-ai-surface));   color: var(--rkb-ask-ai-ink);   margin: 20px 0;   font-size: 16px;   line-height: 1.5;   min-width: 0; } .rkb-ask-ai, .rkb-ask-ai \* \{ box-sizing: border-box; } .rkb-ask-ai-single \{ container: rkb-ask-ai / inline-size; } .dark .rkb-ask-ai \{   --rkb-ask-ai-accent: var(--adoc-color-primary, #8ba9ff);   --rkb-ask-ai-ink: #eeeff1;   --rkb-ask-ai-muted: #b2b5bd;   --rkb-ask-ai-surface: #202126;   --rkb-ask-ai-item: #292b31;   --rkb-ask-ai-border: #3d4049;   --rkb-ask-ai-label-ink: color-mix(in srgb, var(--rkb-ask-ai-accent) 68%, #fff);   --rkb-ask-ai-label-surface: color-mix(in srgb, var(--rkb-ask-ai-accent) 14%, var(--rkb-ask-ai-surface));   --rkb-ask-ai-hover-surface: #292b31; } .rkb-ask-ai .rkb-ask-ai-questions \{ display: grid; gap: 8px; margin: 0; min-width: 0; } .rkb-ask-ai .rkb-ask-ai-question \{   appearance: none; display: flex; align-items: center; gap: 14px;   width: 100%; min-width: 0; min-height: 52px; margin: 0;   padding: var(--rkb-ask-ai-padding, 10px 16px);   border: 1px solid var(--rkb-ask-ai-border); border-radius: var(--rkb-ask-ai-radius, 8px);   background: var(--rkb-ask-ai-surface); color: inherit;   font: inherit; text-align: start; cursor: pointer;   transition: border-color .15s, background-color .15s; } .rkb-ask-ai .rkb-ask-ai-question:hover \{   border-color: color-mix(in srgb, var(--rkb-ask-ai-accent) 35%, var(--rkb-ask-ai-border));   background: var(--rkb-ask-ai-hover-surface); } .rkb-ask-ai .rkb-ask-ai-question:hover .rkb-ask-ai-arrow \{ color: var(--rkb-ask-ai-label-ink); } .rkb-ask-ai .rkb-ask-ai-question:focus-visible \{ outline: 2px solid var(--rkb-ask-ai-accent); outline-offset: 3px; } .rkb-ask-ai .rkb-ask-ai-label \{   display: inline-flex; align-items: center; gap: var(--rkb-ask-ai-label-gap, 2px); flex: 0 0 auto;   width: max-content; max-width: 100%; padding: var(--rkb-ask-ai-label-padding, 2px 8px); border-radius: 999px;   background: var(--rkb-ask-ai-label-surface); color: var(--rkb-ask-ai-label-ink);   font-size: 14px; line-height: 20px; font-weight: 600; } .rkb-ask-ai .rkb-ask-ai-label:has(> .rkb-ask-ai-icon) \{ padding-inline-start: var(--rkb-ask-ai-label-icon-inset, 2px); } .rkb-ask-ai .rkb-ask-ai-icon, .rkb-ask-ai .rkb-ask-ai-arrow \{ flex: 0 0 auto; display: block; margin: 0; } .rkb-ask-ai .rkb-ask-ai-icon \{ width: 24px; height: 24px; max-width: none; object-fit: contain; padding: 0; border: 0; box-shadow: none; } .rkb-ask-ai .rkb-ask-ai-text \{ flex: 1; min-width: 0; font-weight: 400; overflow-wrap: anywhere; } .rkb-ask-ai .rkb-ask-ai-arrow \{ color: var(--rkb-ask-ai-muted); } .rkb-ask-ai-group \{ background: var(--rkb-ask-ai-surface); padding: var(--rkb-ask-ai-padding, 14px 16px); border: 1px solid var(--rkb-ask-ai-border); border-radius: var(--rkb-ask-ai-radius, 8px); } .rkb-ask-ai .rkb-ask-ai-header \{ margin: 0 0 10px; } .rkb-ask-ai-group .rkb-ask-ai-question \{ background: var(--rkb-ask-ai-item); min-height: 48px; padding: 10px 14px; border-radius: var(--rkb-ask-ai-radius, 6px); } .rkb-ask-ai-group\[data-layout="grid"] .rkb-ask-ai-questions \{ grid-template-columns: repeat(auto-fit, minmax(min(100%, max(260px, calc((100% - 8px) / 2))), 1fr)); } .rkb-ask-ai .rkb-ask-ai-status \{ margin: 0; color: var(--rkb-ask-ai-muted); font-size: 13px; line-height: 1.6; } .rkb-ask-ai .rkb-ask-ai-status:not(:empty) \{ margin-top: 10px; } @container rkb-ask-ai (max-width: 560px) \{   .rkb-ask-ai-single .rkb-ask-ai-question \{ display: grid; grid-template-columns: minmax(0, 1fr) 18px; gap: 8px 12px; }   .rkb-ask-ai-single .rkb-ask-ai-label \{ grid-column: 1; grid-row: 1; }   .rkb-ask-ai-single .rkb-ask-ai-text \{ grid-column: 1; grid-row: 2; }   .rkb-ask-ai-single .rkb-ask-ai-arrow \{ grid-column: 2; grid-row: 1 / 3; align-self: center; } } @media (max-width: 640px) \{   .rkb-ask-ai-group \{ padding: var(--rkb-ask-ai-padding, 14px); } } @media (prefers-reduced-motion: reduce) \{ .rkb-ask-ai .rkb-ask-ai-question \{ transition: none; } }</style>

export function rkbCreateAskAIController(doc) {
  // Adapter for the current RKB native assistant. No messages are submitted.
  const win = doc.defaultView;
  const drafts = new WeakMap();
  const listeners = new Set();
  const resets = new Set();
  let observer, pending, available = false, opening = false, icon = '';
  const entry = () => Array.from(doc.querySelectorAll('#navbar button[aria-label="打开 AI 智能专员"], #navbar button[aria-label="Open AI assistant"]'))
    .find(node => !node.disabled && !node.hidden && node.getAttribute('aria-hidden') !== 'true' && node.getClientRects().length);
  const panel = () => doc.querySelector('.ai-assistant-panel[data-open="true"]:not([aria-hidden="true"])');
  const refresh = () => {
    const trigger = entry();
    const next = Boolean(trigger);
    const nextIcon = trigger?.querySelector('img')?.src || '';
    if (next !== available || nextIcon !== icon) {
      available = next; icon = nextIcon;
      listeners.forEach(fn => fn(available, icon));
    }
  };
  const pause = (ms, signal) => new Promise(resolve => {
    if (signal.aborted) { resolve(); return; }
    const finish = () => { win.clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = win.setTimeout(finish, ms);
    signal.addEventListener('abort', finish, {once: true});
  });
  const draftFor = input => {
    if (!drafts.has(input)) {
      const draft = {value: null, writing: false, composing: false};
      input.addEventListener('input', () => { if (!draft.writing) { draft.value = null; resets.forEach(fn => fn()); } });
      // Native change may arrive on blur after an older edit. Input tracks the
      // actual edit; treating delayed change as a new edit revokes fresh drafts.
      input.addEventListener('compositionstart', () => { draft.composing = true; draft.value = null; });
      input.addEventListener('compositionend', () => { draft.composing = false; });
      drafts.set(input, draft);
    }
    return drafts.get(input);
  };
  return {
    subscribe(fn, reset = () => {}) {
      listeners.add(fn);
      resets.add(reset);
      if (!observer) {
        observer = new win.MutationObserver(refresh);
        observer.observe(doc.body, {childList: true, subtree: true, attributes: true,
          attributeFilter: ['disabled', 'hidden', 'aria-hidden', 'aria-label', 'class', 'style', 'src']});
        win.addEventListener('resize', refresh);
      }
      refresh(); fn(available, icon);
      return () => {
        listeners.delete(fn);
        resets.delete(reset);
        if (!listeners.size) {
          observer.disconnect(); observer = null;
          win.removeEventListener('resize', refresh);
          pending?.abort();
        }
      };
    },
    async fill(query, {replacePrevious = true, signal: callerSignal} = {}) {
      if (callerSignal?.aborted) return 'cancelled';
      resets.forEach(fn => fn());
      pending?.abort();
      const controller = new win.AbortController();
      const {signal} = controller;
      pending = controller;
      const abort = () => controller.abort();
      callerSignal?.addEventListener('abort', abort, {once: true});
      try {
        if (!panel() && !opening) {
          const trigger = entry();
          if (!trigger) return 'unavailable';
          opening = true;
          trigger.click();
        }
        let currentPanel, input;
        for (let attempt = 0; attempt < 50 && !signal.aborted; attempt += 1) {
          currentPanel = panel();
          input = currentPanel?.querySelector('form.ai-assistant-input textarea');
          if (input) break;
          await pause(50, signal);
        }
        if (signal.aborted) return 'cancelled';
        if (!input) return 'unavailable';
        if (input.disabled || input.readOnly) return 'busy';
        const draft = draftFor(input);
        if (draft.composing || currentPanel.querySelector('.ai-assistant-image-preview-item')) {
          input.focus(); return 'draft';
        }
        if (input.value === query) { input.focus(); return 'filled'; }
        const ownsDraft = draft.value !== null && input.value === draft.value;
        if (input.value.trim() && !(replacePrevious && ownsDraft)) {
          input.focus(); return 'draft';
        }
        const setter = Object.getOwnPropertyDescriptor(win.HTMLTextAreaElement.prototype, 'value')?.set;
        if (!setter) return 'failed';
        draft.writing = true;
        try {
          setter.call(input, query);
          input.dispatchEvent(new win.Event('input', {bubbles: true}));
          draft.value = query;
        } finally { draft.writing = false; }
        // Wait for React's controlled input to commit. Never click Send or submit a form.
        await pause(0, signal);
        if (signal.aborted) return 'cancelled';
        if (panel() !== currentPanel || !input.isConnected || input.value !== query) {
          draft.value = null; return 'failed';
        }
        if (!input.disabled) input.focus();
        return 'filled';
      } catch {
        return signal.aborted ? 'cancelled' : 'failed';
      } finally {
        callerSignal?.removeEventListener('abort', abort);
        if (pending === controller) { pending = null; opening = false; }
      }
    }
  };
}

export function RkbAskAI({question, questions, label = '询问 AI 助手', layout = 'list', replacePrevious = true, messages = {}}) {
  const [available, setAvailable] = useState(false);
  const [icon, setIcon] = useState('');
  const [status, setStatus] = useState('');
  const [working, setWorking] = useState(false);
  const adapter = useRef(null);
  const request = useRef(null);
  useEffect(() => {
    const key = Symbol.for('rkb.ask-ai.controller.v2');
    if (!window[key]) window[key] = rkbCreateAskAIController(document);
    adapter.current = window[key];
    const unsubscribe = adapter.current.subscribe((ready, source) => {
      setAvailable(ready); setIcon(source);
    }, () => setStatus(''));
    return () => { request.current?.abort(); unsubscribe(); };
  }, []);
  const items = question ? [question] : questions || [];
  const single = items.length === 1;
  const labels = {
    filled: '',
    draft: '助手中已有待发送的内容或附件，请先处理后再选择问题。',
    busy: '助手正在回答，请结束后再选择问题。',
    unavailable: '助手暂未就绪，请稍后重试。',
    failed: '暂时无法带入问题，请在助手中输入。',
    ...messages
  };
  const choose = async value => {
    request.current?.abort();
    const current = new AbortController();
    request.current = current;
    setWorking(true); setStatus('');
    const result = await adapter.current.fill(value, {replacePrevious, signal: current.signal});
    if (current.signal.aborted || request.current !== current) return;
    setWorking(false); setStatus(result === 'cancelled' ? '' : labels[result]?.trim() || '');
  };
  if (!available || !items.length) return null;
  const badge = <span className="rkb-ask-ai-label">{icon && <img className="rkb-ask-ai-icon" src={icon} width="24" height="24" alt="" aria-hidden="true" />}{label}</span>;
  return (
    <div className={`rkb-ask-ai ${single ? 'rkb-ask-ai-single' : 'rkb-ask-ai-group'}`} data-layout={layout}>
      {!single && <div className="rkb-ask-ai-header">{badge}</div>}
      <div className="rkb-ask-ai-questions" role="group" aria-label={label} aria-busy={working}>
        {items.map(value => <button className="rkb-ask-ai-question" type="button" key={value} onClick={() => choose(value)}>
          {single && badge}<span className="rkb-ask-ai-text">{value}</span>
          <svg className="rkb-ask-ai-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
        </button>)}
      </div>
      <div className="rkb-ask-ai-status" role="status" aria-live="polite">{status}</div>
    </div>
  );
}

<div className="help-center-hidden">
  <RkbAskAI question={"购买 Token Plan 后，需要更换 API Key 和 Base URL 吗？"} />
</div>

## 获取 API Key <span id="c38fb45bc6sje" /> <span id="ca06817d4cqro" />

1. 前往目标地域的 API Key 页面，例如[华北2（北京）](https://bailian.console.aliyun.com/cn-beijing/model/settings/api-key)。每个地域有独立的接入域名、API Key 和模型列表，<strong>不能跨地域混用</strong>，各地域的 API Key 入口和接入域名请参见[各地域接入信息](/zh/model-studio/regions#h2_cc92e61c)。

2. 若需创建 API Key，单击<strong>创建 API Key</strong>，在弹窗中配置以下选项后单击<strong>确定</strong>（若无法创建，请联系超级管理员或业务空间管理员）：

   - <strong>归属账号</strong>：默认选择<strong>阿里云账号（主账号）</strong>（账号名通常为一串数字）。如需为团队成员或应用创建权责独立的 API Key 并结合业务空间做精细化模型访问控制，可选择 [RAM 用户](https://help.aliyun.com/zh/ram/user-guide/overview-of-ram-users)（账号格式 `username@<AccountAlias>.onaliyun.com`）。
   - <strong>归属业务空间</strong>：默认选择<strong>默认业务空间</strong>（数量上限与主账号配额见[时效性与限制](#apikey-limits)）。如需权限隔离、精细化模型访问控制或独立成本核算，请选择非默认业务空间，参见[业务空间管理](/zh/model-studio/permission-management-overview)。
   - <strong>权限</strong>：建议选择<strong>全部</strong>。如需精细控制，可选择<strong>自定义</strong>，配置可访问 IP 和可访问模型范围（数量限制见[时效性与限制](#apikey-limits)）。

3. 创建成功后，立即在弹出的对话框中复制（或下载保存）完整的 API Key。新版 API Key 仅在创建成功时完整显示一次，关闭对话框后列表中只显示脱敏值，无法再次查看或复制完整明文；若未保存，只能重置或重新创建 API Key。

<Note>
  部分旧版 API Key 仍可在列表中直接复制完整值，以列表中是否提供复制入口为准。
</Note>

若需通过程序自动化创建或管理 API Key（如 CreateApiKey、ListApiKeys），可调用[ModelStudio OpenAPI](https://next.api.aliyun.com/api/ModelStudio/2026-02-10)：使用阿里云主账号或 RAM 用户的 AccessKey 发起调用，RAM 用户需具备 `AliyunBailianFullAccess` 系统策略或包含 `modelstudio:CreateApiKey` 等相应权限的自定义策略（OpenAPI 路径的 RAM 权限与控制台创建所需的[超级管理员或业务空间管理员](/zh/model-studio/permission-management-overview#982297bd47p3i)角色相互独立）。

## 配置 API Key 到环境变量 <span id="20b17d4430qvt" /> <span id="6a82f1a968bhf" />

- <strong>方式一：在</strong>[<strong>第三方工具</strong>](/zh/model-studio/use-chat-client-or-development-tool)<strong>中进行配置</strong>

  如果在 Chatbox 等工具或平台中调用模型，您可能需要输入三个信息：

  - 本文获取的 API Key
  - Base URL：

    - 华北2（北京）：`https://dashscope.aliyuncs.com/compatible-mode/v1`
    - 其他地域：请参见[Base URL 总览](/zh/model-studio/base-url)
  - 模型名称，如 qwen-plus、qwen-max、deepseek-v4-pro 等。

  我们也提供了一些常用工具的配置方法：[Dify](/zh/model-studio/dify)、[Chatbox](/zh/model-studio/chatbox)、[Cline](/zh/model-studio/cline)、[Claude Code](/zh/model-studio/claude-code)、[Postman](/zh/model-studio/first-call-to-image-and-video-api)。
- <strong>方式二：配置 API Key 到环境变量，后续支持 cURL 和代码调用</strong>

  <Tip>
    请勿在客户端代码（如浏览器、移动应用）或不可信环境中配置或使用长期有效的 API Key。可以使用[临时 API Key](/zh/model-studio/generate-temporary-api-key)（最长 1800 秒）。
  </Tip>

  以下示例中的 `<YOUR_API_KEY>` 需替换为真实的 API Key。

  <Tabs>
    <Tab title="Linux系统">
      <Tabs>
        <Tab title="添加永久性环境变量">
          将环境变量设置追加到`~/.bashrc`文件中。

          ```bash
          echo "export DASHSCOPE_API_KEY='<YOUR_API_KEY>'" >> ~/.bashrc
          source ~/.bashrc
          echo "百炼 API Key 永久配置为：${DASHSCOPE_API_KEY:0:10}*********"
          ```
        </Tab>

        <Tab title="添加临时性环境变量">
          ```bash
          export DASHSCOPE_API_KEY='<YOUR_API_KEY>'
          echo "当前会话百炼 API Key 配置为：${DASHSCOPE_API_KEY:0:10}*********"
          ```
        </Tab>

        <Tab title="服务管理器 (systemd)">
          以下操作适用于将应用作为后台服务部署的场景。

          1. <strong>创建环境文件</strong>

          ```bash
          sudo sh -c "echo 'DASHSCOPE_API_KEY=<YOUR_API_KEY>' > /etc/your-app/env"
          sudo chmod 600 /etc/your-app/env # 限制只有root用户有访问权限
          ```

          2. <strong>修改 systemd 服务文件</strong>（如 `/etc/systemd/system/your-app.service`）：

          ```zsh
          [Service]
          # 加载密钥文件
          EnvironmentFile=/etc/your-app/env
          ExecStart=/usr/bin/python /opt/your-app/main.py
          ```

          3. <strong>重载服务</strong>

          ```bash
          sudo systemctl daemon-reload
          sudo systemctl restart your-app
          ```
        </Tab>
      </Tabs>
    </Tab>

    <Tab title="macOS系统">
      <Tabs>
        <Tab title="添加永久性环境变量">
          将环境变量设置追加到`~/.bash_profile`或`~/.zshrc`文件中。

          ```bash
          VAR_VALUE="<YOUR_API_KEY>"; \
          echo "export DASHSCOPE_API_KEY='$VAR_VALUE'" >> ~/.zshrc 2>/dev/null
          echo "export DASHSCOPE_API_KEY='$VAR_VALUE'" >> ~/.bash_profile 2>/dev/null
          source ~/."${SHELL##*/}rc" 2>/dev/null
          echo "百炼 API Key 永久配置为：${DASHSCOPE_API_KEY:0:10}*********"
          ```
        </Tab>

        <Tab title="添加临时性环境变量">
          ```bash
          export DASHSCOPE_API_KEY='<YOUR_API_KEY>'
          echo "当前会话百炼 API Key 配置为：${DASHSCOPE_API_KEY:0:10}*********"
          ```
        </Tab>
      </Tabs>
    </Tab>

    <Tab title="Windows系统">
      在Windows系统中，您可以通过系统属性、CMD或PowerShell配置环境变量。

      <Tabs>
        <Tab title="系统属性">
          系统属性方式注意事项：

          - 环境变量永久生效。
          - 修改系统环境变量需具备管理员权限。
          - 配置后不会立即影响已经打开的命令窗口、IDE或其他正在运行的应用程序，需重启这些程序或打开新的命令行使环境变量生效。

          1. 在Windows系统桌面中按`Win+Q`键，在搜索框中搜索<strong>编辑系统环境变量</strong>，单击打开<strong>系统属性</strong>界面。
          2. 在<strong>系统属性</strong>窗口，单击<strong>环境变量</strong>，然后在<strong>系统变量</strong>区域下单击<strong>新建</strong>，<strong>变量名</strong>填入`DASHSCOPE_API_KEY`，<strong>变量值</strong>填入您的DashScope API Key。
          3. 依次单击三个窗口的<strong>确定</strong>，关闭系统属性配置页面，完成环境变量配置。
          4. 打开CMD（命令提示符）窗口或Windows PowerShell窗口，执行如下命令检查环境变量是否生效。

             - CMD查询命令：

          ```bash
          echo 百炼 API Key 永久配置为：%DASHSCOPE_API_KEY:~0,10%*********
          ```

          - Windows PowerShell查询命令：

          ```powershell
          Write-Host "百炼 API Key 永久配置为：$($env:DASHSCOPE_API_KEY.Substring(0, [Math]::Min(10, $env:DASHSCOPE_API_KEY.Length)))*********"
          ```
        </Tab>

        <Tab title="CMD">
          <Tabs>
            <Tab title="添加永久性环境变量">
              如果您希望API Key环境变量在当前用户的所有新会话中生效，可以按如下操作。

              1. 在CMD中运行以下命令。

              ```bash
              setx DASHSCOPE_API_KEY "<YOUR_API_KEY>"
              ```

              2. 打开一个新的CMD窗口。
              3. 在新的CMD窗口运行以下命令，检查环境变量是否生效。

              ```bash
              echo 百炼 API Key 永久配置为：%DASHSCOPE_API_KEY:~0,10%*********
              ```
            </Tab>

            <Tab title="添加临时性环境变量">
              如果您仅希望在当前会话中使用该环境变量，可以在CMD中运行以下命令。

              ```bash
              set "DASHSCOPE_API_KEY=<YOUR_API_KEY>"
              ```

              您可以在当前会话运行以下命令检查环境变量是否生效。

              ```bash
              echo 当前会话百炼 API Key 配置为：%DASHSCOPE_API_KEY:~0,10%*********
              ```
            </Tab>
          </Tabs>
        </Tab>

        <Tab title="PowerShell">
          <Tabs>
            <Tab title="添加永久性环境变量">
              如果您希望API Key环境变量在当前用户的所有新会话中生效，可以按如下操作。

              1. 在PowerShell中运行以下命令。

              ```powershell height="62"
              [Environment]::SetEnvironmentVariable("DASHSCOPE_API_KEY", "<YOUR_API_KEY>", [EnvironmentVariableTarget]::User)
              ```

              2. 打开一个新的PowerShell窗口。
              3. 在新的PowerShell窗口运行以下命令，检查环境变量是否生效。

              ```powershell
              Write-Host "百炼 API Key 永久配置为：$($env:DASHSCOPE_API_KEY.Substring(0, [Math]::Min(10, $env:DASHSCOPE_API_KEY.Length)))*********"
              ```
            </Tab>

            <Tab title="添加临时性环境变量">
              如果您仅希望在当前会话中使用该环境变量，可以在PowerShell中运行以下命令。

              ```powershell
              $env:DASHSCOPE_API_KEY = "<YOUR_API_KEY>"
              Write-Host "当前会话百炼 API Key 配置为：$($env:DASHSCOPE_API_KEY.Substring(0, [Math]::Min(10, $env:DASHSCOPE_API_KEY.Length)))*********"
              ```
            </Tab>
          </Tabs>
        </Tab>
      </Tabs>
    </Tab>
  </Tabs>

## 时效性与限制 <span id="apikey-limits" /> <span id="7d2ee55621wns" /> <span id="fd72c5c1besqv" />

API Key 没有失效时间限制，若需要有时效性的 API Key，可生成[临时 API Key](/zh/model-studio/generate-temporary-api-key)（最长 1800 秒）。

API Key 的状态随账号操作而变化。主账号和具备该业务空间 API Key 权限的 RAM 用户均可删除 API Key。

<Note>
  - 2026年3月25日前由 RAM 用户创建的 API Key 与 RAM 用户绑定。在 RAM 控制台删除该 RAM 用户时，百炼会同步删除这些 API Key，且不可恢复。删除 RAM 用户前，请确认其名下 API Key 的使用情况；如需保留调用能力，请使用主账号或其他账号重新创建 API Key，并更新业务配置。
  - 2026年3月25日及之后创建的 API Key 不与 RAM 用户级联。删除 RAM 用户后，这些 API Key 仍然保留并可继续使用。
</Note>

<table style={{ display: "table", tableLayout: "fixed", width: "100%", overflowWrap: "anywhere" }}>
  <colgroup>
    <col style={{ width: "24.67%" }} />

    <col style={{ width: "29.54%" }} />

    <col style={{ width: "45.78%" }} />
  </colgroup>

  <thead>
    <tr>
      <th style={{ verticalAlign: "top" }}>
        <p>
          <strong>触发操作</strong>
        </p>
      </th>

      <th style={{ verticalAlign: "top" }}>
        <p>
          <strong>主账号的 API Key</strong>
        </p>
      </th>

      <th style={{ verticalAlign: "top" }}>
        <p>
          <strong>RAM 账号的 API Key</strong>
        </p>
      </th>
    </tr>
  </thead>

  <tbody>
    <tr>
      <td style={{ verticalAlign: "top" }}>
        <strong>主动删除 API Key</strong>
      </td>

      <td style={{ verticalAlign: "top" }}>
        支持（主账号默认具备权限；RAM 用户需具备所属业务空间的 API Key 管理权限）。删除后立即失效，不可恢复。
      </td>

      <td style={{ verticalAlign: "top" }}>
        支持（主账号默认具备权限；RAM 用户需具备所属业务空间的 API Key 管理权限）。删除后立即失效，不可恢复。
      </td>
    </tr>

    <tr>
      <td style={{ verticalAlign: "top" }}>
        <strong>将账号移出业务空间</strong>
      </td>

      <td style={{ verticalAlign: "top" }}>
        —
      </td>

      <td style={{ verticalAlign: "top" }}>
        移出业务空间后 API Key 失效，重新加入后恢复生效
      </td>
    </tr>

    <tr>
      <td style={{ verticalAlign: "top" }}>
        <strong>在</strong>[RAM 控制台](https://ram.console.aliyun.com/roles)<strong>删除账号/角色</strong>
      </td>

      <td style={{ verticalAlign: "top" }}>
        —
      </td>

      <td style={{ verticalAlign: "top" }}>
        2026年3月25日前创建的 API Key：同步删除，不可恢复。

        2026年3月25日及之后创建的 API Key：不受影响，继续有效。
      </td>
    </tr>
  </tbody>
</table>

### 删除 API Key 后的异步任务

删除 API Key 后，该 API Key 无法使用，也无法找回。如果该 API Key 关联的异步任务还未执行或还未执行完毕，删除 API Key 后系统依然会正常执行这些任务。

如果确认不希望继续执行已关联的异步任务，请手动终止相关任务，避免在 API Key 删除后产生账单。

### 数量与权限限制 <span id="apikey-quota" />

API Key 相关限制汇总：

- <strong>API Key 数量</strong>：账号+地域维度最多 50 个，不按业务空间限制；单个主账号最多 20 个业务空间（含默认业务空间）。
- <strong>自定义权限可选模型</strong>：最多 30 个，限于该业务空间已授权的模型。
- <strong>IP 白名单</strong>：最多 20 个地址或网段；IPv6 仅华北2（北京）地域支持；批量输入用英文逗号隔开。
- <strong>临时 API Key</strong>：最长 1800 秒。

## API 调用 <span id="4dd13345796cg" /> <span id="68bf80d8faprx" />

请访问[文本生成](/zh/model-studio/qwen-api-reference)以及更多模型的 API 参考。

OpenAI SDK 支持的模型，请参考[OpenAI 兼容](/zh/model-studio/toolkits-and-frameworks)。

## 常见问题 <span id="e6a57c054bfzy" /> <span id="4ed8cb6687hz6" />

### 无法创建 API Key？ <span id="9603b994a7nx6" />

API Key 的创建需使用[超级管理员](/zh/model-studio/permission-management-overview#982297bd47p3i)或[业务空间管理员](/zh/model-studio/permission-management-overview#c82f37c2033vw)操作。

### 如何管理 API Key 的权限？ <span id="44eed06516tbh" />

API Key 的调用权限完全由其<strong>归属业务空间</strong>决定。<strong>同一空间内的 API Key 权限相同</strong>，无需为不同模型（如文生文、文生图、语音合成）创建不同的 API Key。

- <strong>默认业务空间下的 API Key：</strong>可调用所有[标准模型](/zh/model-studio/models)，以及默认业务空间内的[应用](/zh/model-studio/flow-agent-introduction)。
- <strong>子业务空间下的 API Key：</strong>可调用该子业务空间已获得[模型调用授权](/zh/model-studio/permission-management-overview)的标准模型，以及该业务空间内的应用。

<strong>调用在阿里云百炼</strong>[<strong>调优后的模型</strong>](/zh/model-studio/model-training-overview)<strong>：</strong>此类模型部署成功后，仅能用其所在业务空间的API Key调用。

如需在业务空间之外做更细粒度的控制，可在创建或编辑 API Key 时将<strong>权限</strong>切换为<strong>自定义</strong>，配置：

- <strong>IP 白名单规则</strong>：默认放通全部 IPv4，完整规则参见[时效性与限制](#apikey-limits)。
- <strong>访问模型范围</strong>：开关开启后，该 API Key 仅能调用已勾选的模型（限于该业务空间已授权的模型，数量限制参见[时效性与限制](#apikey-limits)）。

### 环境变量已设置，为何代码仍提示找不到 API Key？ <span id="a486eb2dc2p5y" />

具体原因如下：

- 情况一：<strong>没有设置永久性环境变量</strong>。临时环境变量只在当前终端会话中有效，对于已经启动的 IDE 或其他应用程序并不会生效。请参考本文中设置永久性环境变量的方法。
- 情况二：<strong>没有重启IDE、命令行工具或应用</strong>。

  - 通常需要重启 IDE（如 VS Code）或命令行工具，使其能够加载最新的环境变量。
  - 如果在部署应用后设置了环境变量，可能需要重启应用服务，让应用能够重新加载环境变量。
- 情况三：<strong>需要在配置文件添加环境变量</strong>。如果您的应用是通过服务管理器（如 systemd、supervisord）启动的，可能需要在服务管理器的配置文件中添加环境变量。
- 情况四：<strong>用了sudo命令</strong>。如果使用`sudo python xx.py`运行脚本，可能会遗漏当前用户环境变量，因为`sudo`默认不继承所有环境变量。您可采用`sudo -E python xx.py`命令，其中的`-E` 参数确保环境变量被传递。如有权限执行该脚本，可以直接执行 `python xx.py`。

### 单个主账号下最多能创建多少个API Key？ <span id="e2f8ef0826duu" />

每个主账号下最多可创建20个业务空间（包括默认业务空间）；API Key 数量为账号+地域维度 50 个，不按业务空间限制。
