import React, { useEffect, useState } from "react";
import { nanoid } from "nanoid";

interface ImageFile {
    id: string;
    name: string;
    type: string;
    base64: string;
}

interface Storage {
    files: ImageFile[];
}

function imageFileToDataUrl(image: ImageFile) {
    return `data:${image.type};base64,${image.base64}`;
}

export function App() {
    const [state, setState] = useState<Storage>(JSON.parse(localStorage.getItem("cgs") as string) || { files: [] });

    useEffect(() => {
        localStorage.setItem("cgs", JSON.stringify(state));
    }, [state]);

    return (
        <div className="p-8">
            <div>
                <input
                    type="file"
                    onChange={async (ev) => {
                        let files = ev.target.files;
                        if (!files) return;

                        for (let i = 0; i < files.length; i++) {
                            let file = files[i];

                            let binary = "";
                            let bytes = new Uint8Array(await file.arrayBuffer());
                            for (let b = 0; b < bytes.byteLength; b++) {
                                binary += String.fromCharCode(bytes[b]);
                            }

                            let base64Raw = btoa(binary);
                            // let base64 = `data:image/png;base64,${base64Raw}`;

                            setState({ ...state, files: [...state.files, { base64: base64Raw, type: file.type, name: file.name, id: nanoid() }] });
                        }
                    }}
                />
            </div>
            <div>
                {state.files.map((file) => (
                    <div key={file.name}>
                        <h2>{file.name}</h2>
                        <img className="w-52 h-52" src={imageFileToDataUrl(file)} />
                        <button onClick={() => setState({ ...state, files: state.files.filter((e) => e.id !== file.id) })}>Remove</button>
                    </div>
                ))}
            </div>
        </div>
    );
}
