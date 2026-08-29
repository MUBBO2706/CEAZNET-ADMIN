const fs = require('fs');
let content = fs.readFileSync('pages/SupportInboxPage.tsx', 'utf8');
content = content.replace(
    /onInput=\{\(\) \=\> \{\n\s*if \(richEditorRef\.current\) \{\n\s*setReplyTextDebounced\(richEditorRef\.current\.innerText \|\| richEditorRef\.current\.innerHTML\);\n\s*\}/,
    `onInput={(e) => {\n                                                        if (richEditorRef.current) {\n                                                            const html = richEditorRef.current.innerHTML;\n                                                            if (html === '<br>' || html === '<div><br></div>' || html === '<p><br></p>') {\n                                                                richEditorRef.current.innerHTML = '';\n                                                            }\n                                                            setReplyTextDebounced(richEditorRef.current.innerText || richEditorRef.current.innerHTML);\n                                                        }`
);
fs.writeFileSync('pages/SupportInboxPage.tsx', content);
