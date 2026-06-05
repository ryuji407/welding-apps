import React, { useRef } from 'react';
import { Upload } from 'lucide-react';

interface FileUploaderProps {
    onFileUpload: (content: string | File, fileType: 'csv' | 'excel', fileName: string) => void;
}

export function FileUploader({ onFileUpload }: FileUploaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const readFile = (file: File) => {
        const fileName = file.name.toLowerCase();

        // ファイル拡張子を判定
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
            // Excelファイルの場合、Fileオブジェクトをそのまま渡す
            onFileUpload(file, 'excel', file.name);
            return;
        }

        // CSVファイルの場合、テキストとして読み込む
        const tryRead = (encoding: string) => {
            return new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target?.result as string);
                reader.onerror = (e) => reject(e);
                reader.readAsText(file, encoding);
            });
        };

        // Common Japanese CSV headers to check for successful decoding
        const keywords = ['工程', '開始日', '終了日', '完成品番', '設備', '作業', '担当', '製品', '品番', '数量'];

        tryRead('Shift-JIS').then((content) => {
            // Check if content seems correctly decoded
            const hasKeywords = keywords.some(k => content.includes(k));
            const firstLine = content.split(/\r?\n/)[0] || '';
            // CSVのパースを簡易的に行い、最初が日付形式かチェック
            const isHeaderless = /^\d{4}\/\d{1,2}\/\d{1,2}/.test(firstLine.split(',')[0]?.replace(/"/g, '') || '');

            if (hasKeywords || isHeaderless) {
                console.log('Detected Shift-JIS encoding');
                onFileUpload(content, 'csv', file.name);
            } else {
                console.log('Shift-JIS check failed, trying UTF-8');
                tryRead('UTF-8').then((utfContent) => {
                    onFileUpload(utfContent, 'csv', file.name);
                });
            }
        }).catch(() => {
            // Fallback to default (UTF-8)
            tryRead('UTF-8').then((utfContent) => {
                onFileUpload(utfContent, 'csv', file.name);
            });
        });
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        readFile(file);

        // Reset input so the same file can be selected again if needed
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div>
            <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1 px-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 border border-transparent"
                title="スケジュールをインポート"
            >
                <Upload size={22} />
                <span className="text-xs font-medium">インポート</span>
            </button>
        </div>
    );
}
