import React, { useEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import * as idb from "idb";
import { Field, useForm } from "typed-react-form";
import JSZip from "jszip";
import { saveAs } from "file-saver";

interface ImageFile {
    id: string;
    name: string;
    type: string;
    base64: string;
}

interface Card {
    amount?: number;
    id: string;
    imageId?: number;
    imageHeight?: number;
    imageWidth?: number;
    imageX?: number;
    imageY?: number;
    imageFilter?: string;
    value: string;
    valueDescription: string;
    text: string;
    textFont?: string;
    textColor?: string;
    borderColor?: string;
    borderTextColor?: string;
    borderSmallTextColor?: string;
    noGradient: boolean;
    description: string;
    base64?: string;
}

function imageFileToDataUrl(image: ImageFile) {
    return `data:${image.type};base64,${image.base64}`;
}

function imageFileToImage(image: ImageFile): Promise<HTMLImageElement> {
    return new Promise((res, rej) => {
        let img = new Image();
        img.onload = () => {
            res(img);
        };
        img.onerror = rej;
        img.src = imageFileToDataUrl(image);
    });
}

export function App() {
    const [database, setDatabase] = useState<idb.IDBPDatabase>();

    useEffect(() => {
        idb.openDB("cgs", 1, {
            upgrade: (db, oldVersion, newVersion, transaction) => {
                if (oldVersion === 0) {
                    db.createObjectStore("image", { keyPath: "id" });
                    db.createObjectStore("card", { keyPath: "id" });
                }
            },
        }).then(setDatabase);
    }, []);

    if (!database) {
        return <p>loading...</p>;
    } else {
        return <Dashboard database={database} />;
    }
}

export function Dashboard({ database }: { database: idb.IDBPDatabase }) {
    const [card, setCard] = useState<Card>();
    const [images, setImages] = useState<ImageFile[]>([]);
    const [cards, setCards] = useState<Card[]>([]);
    const cardCount = useMemo(() => cards.reduce((a, e) => (e.amount || 1) + a, 0), [cards]);
    const processLabelRef = useRef<HTMLParagraphElement>(null);

    async function refreshImages() {
        let i = (await database.getAll("image")) as ImageFile[];
        i.sort((a, b) => a.name.localeCompare(b.name));
        setImages(i);
    }

    async function refreshCards() {
        let c = (await database.getAll("card")) as Card[];

        // Temp fix
        for (let i = 0; i < c.length; i++) {
            if (c[i].amount) {
                c[i].amount = parseInt(c[i].amount as any);
            }
        }

        c.sort((a, b) => a.value.localeCompare(b.value));
        setCards(c);
    }

    useEffect(() => {
        refreshImages();
        refreshCards();
    }, []);

    return (
        <div className="h-full flex flex-col">
            <div className="bg-white border-b px-4 py-2 font-bold text-blue-500">CARD GAME STUDIO</div>
            <div className="grid grid-cols-3 bg-gray-100 flex-grow">
                <div className="p-4">
                    <div className="flex items-center">
                        <h2 className="text-xl font-bold">{images.length} images</h2>
                        <button
                            className="bg-blue-600 px-4 py-1 text-white mr-1"
                            onClick={async () => {
                                let zip = new JSZip();
                                let allImages = (await database.getAll("image")) as ImageFile[];
                                for (let i = 0; i < allImages.length; i++) {
                                    let image = allImages[i];

                                    processLabelRef.current!.innerText = `Creating zip file ${i + 1}/${allImages.length}`;
                                    zip.file(image.id + ".png", image.base64, { base64: true });
                                }

                                let result = await zip.generateAsync({ type: "blob" }, (data) => {
                                    processLabelRef.current!.innerText = `Exporting... ${data.currentFile} (${Math.round(data.percent)}%)`;
                                });

                                processLabelRef.current!.innerText = "Done, download will start soon...";
                                setTimeout(() => (processLabelRef.current!.innerText = ""), 5000);
                                saveAs(result, "images.zip");
                            }}>
                            Export as zip
                        </button>
                    </div>
                    <input
                        multiple
                        className="my-2"
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
                                await database.add("image", { base64: base64Raw, type: file.type, name: file.name, id: nanoid() });
                                refreshImages();
                            }
                        }}
                    />
                    <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" }}>
                        {images.map((file) => (
                            <div key={file.name} className="border bg-white rounded-md overflow-hidden flex flex-col">
                                <h2 className="text-sm font-mono px-2 pt-2 flex flex-col">
                                    <input
                                        onClick={(ev) => (ev.target as HTMLInputElement).select()}
                                        defaultValue={file.name}
                                        onBlur={async (ev) => {
                                            await database.put("image", {
                                                ...file,
                                                name: ev.target.value,
                                            });
                                            refreshImages();
                                        }}
                                    />
                                </h2>
                                <input
                                    readOnly
                                    className="font-mono text-xs px-2 pb-2"
                                    onClick={(ev) => (ev.target as HTMLInputElement).select()}
                                    value={file.id}
                                />
                                <img className="h-32 px-2" src={imageFileToDataUrl(file)} />
                                <button
                                    className="text-red-600 mt-auto"
                                    onClick={async () => {
                                        await database.delete("image", file.id);
                                        refreshImages();
                                    }}>
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="border-l">
                    <div className="p-4">
                        <div className="flex mb-2 items-center">
                            <h2 className="text-xl font-bold">{cardCount} cards</h2>
                            <p className="ml-auto mr-1" ref={processLabelRef}></p>
                            <button
                                className="bg-blue-600 px-4 py-1 text-white mr-1"
                                onClick={async () => {
                                    let zip = new JSZip();
                                    let allCards = (await database.getAll("card")) as Card[];
                                    let exportJson = false;
                                    let rerender = true;

                                    let rerenderCanvas: null | HTMLCanvasElement;
                                    if (rerender) {
                                        rerenderCanvas = document.createElement("canvas");
                                        rerenderCanvas.width = 732;
                                        rerenderCanvas.height = 1039;
                                    } else {
                                        rerenderCanvas = null;
                                    }
                                    // let rerenderCanvas = null as HTMLCanvasElement | null;

                                    for (let i = 0; i < allCards.length; i++) {
                                        let card = allCards[i];

                                        processLabelRef.current!.innerText = `Rendering card ${i + 1}/${allCards.length}`;

                                        if (rerenderCanvas && card.imageId) {
                                            let image = (await database.get("image", card.imageId)) as ImageFile;
                                            renderCanvas(rerenderCanvas, card, await imageFileToImage(image));
                                            card = {
                                                ...card,
                                                base64: rerenderCanvas.toDataURL(),
                                            };
                                            await database.put("card", card);
                                        }

                                        if (card.base64) {
                                            let headerIndex = card.base64.indexOf(",");
                                            let base64 = headerIndex > 0 ? card.base64.substring(headerIndex + 1) : card.base64;
                                            for (let n = 0; n < (card.amount || 1); n++) {
                                                if (n === 0) {
                                                    zip.file(i + ".png", base64, { base64: true });
                                                } else {
                                                    zip.file(i + "-" + n + ".png", base64, { base64: true });
                                                }
                                            }
                                        }

                                        if (exportJson) {
                                            zip.file(i + ".json", JSON.stringify({ ...card, base64: undefined }));
                                        }
                                    }

                                    rerenderCanvas?.remove();

                                    let result = await zip.generateAsync({ type: "blob" }, (data) => {
                                        processLabelRef.current!.innerText = `Exporting... ${data.currentFile} (${Math.round(data.percent)}%)`;
                                    });

                                    processLabelRef.current!.innerText = "Done, download will start soon...";
                                    setTimeout(() => (processLabelRef.current!.innerText = ""), 5000);
                                    saveAs(result, "game.zip");
                                }}>
                                Export as zip
                            </button>
                            <button
                                className="px-2 py-1 bg-blue-600 text-white"
                                onClick={async () => {
                                    let newCard = {
                                        value: "",
                                        valueDescription: "",
                                        id: nanoid(),
                                        imageX: 0,
                                        imageY: 0,
                                        imageHeight: 1200,
                                        imageWidth: 800,
                                    } as Card;
                                    await database.add("card", newCard);
                                    setCard(newCard);
                                    refreshCards();
                                }}>
                                New card
                            </button>
                        </div>
                        <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                            {cards.map((c) => (
                                <div
                                    key={c.id}
                                    className={"p-2 rounded-md bg-white border " + (c.id === card?.id ? "border-black" : "")}
                                    onClick={() => setCard(c)}>
                                    <h2 className="text-xl flex">
                                        <div>
                                            {c.value} <small className="">{c.valueDescription}</small>
                                            <p className="text-sm">{c.description}</p>
                                            <p className="leading-4 text-sm text-gray-500">{c.text}</p>
                                        </div>
                                        {c.base64 && <img src={c.base64} className="ml-auto w-16 border" />}
                                    </h2>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="border-l">
                    {card && (
                        <div className="flex-shrink-0 p-4">
                            <div className="flex items-center mb-4">
                                <h2 className="text-xl font-bold">Edit card</h2>
                                <button
                                    className="text-red-600 ml-auto"
                                    onClick={async () => {
                                        await database.delete("card", card.id);
                                        setCard(undefined);
                                        refreshCards();
                                    }}>
                                    Remove
                                </button>
                                <button
                                    className="text-blue-600 ml-1"
                                    onClick={async () => {
                                        let newCard = {
                                            ...card,
                                            id: nanoid(),
                                        };
                                        await database.add("card", newCard);
                                        setCard(newCard);
                                        refreshCards();
                                    }}>
                                    Duplicate
                                </button>
                                {card.base64 && (
                                    <button
                                        className="text-blue-600 ml-1"
                                        onClick={async () => {
                                            saveAs(card.base64!, card.id + ".png");
                                        }}>
                                        Download
                                    </button>
                                )}
                            </div>
                            <CardForm
                                database={database}
                                card={card}
                                onChange={async (c) => {
                                    setCard(c);
                                    await database.put("card", c);
                                    refreshCards();
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function renderCanvas(canvas: HTMLCanvasElement, card: Card, convertedImage?: HTMLImageElement) {
    let w = canvas.width,
        h = canvas.height;
    let gl = canvas.getContext("2d")!;
    gl.fillStyle = "white";
    gl.fillRect(0, 0, w, h);

    let borderColor = card.borderColor || "white";
    let borderTextColor = card.borderTextColor || "#555555";
    let borderTextSmallColor = card.borderSmallTextColor || "#999999";
    let textColor = card.textColor || "white";

    // Draw background
    gl.filter = card.imageFilter || "none";
    if (convertedImage) {
        gl.drawImage(convertedImage, card.imageX ?? 0, card.imageY ?? 0, card.imageWidth ?? w, card.imageHeight ?? h);
    }
    gl.filter = "none";

    // Draw gradients
    if (!card.noGradient) {
        let bottomGradient = gl.createLinearGradient(0, 0, 0, h);
        bottomGradient.addColorStop(0.65, "#00000000");
        bottomGradient.addColorStop(1, "#00000088");
        gl.fillStyle = bottomGradient;
        gl.fillRect(0, 0, w, h);

        let topGradient = gl.createLinearGradient(0, 0, 0, h);
        topGradient.addColorStop(0, "#00000088");
        topGradient.addColorStop(0.35, "#00000000");
        gl.fillStyle = topGradient;
        gl.fillRect(0, 0, w, h);
    }

    // Draw main text
    if (card.text) {
        let lines = card.text.split("\n");

        gl.fillStyle = "#000000aa";
        gl.fillRect(0, h * 0.7 - 36, w, lines.length * 42 + 14);

        gl.textAlign = "center";
        gl.font = card.textFont || "34px Besley";
        gl.fillStyle = textColor;
        for (let i = 0; i < lines.length; i++) {
            gl.fillText(lines[i], w / 2, h * 0.7 + 5 + i * 42);
        }
    }

    let cornerWidth = 90 + card.value.length * 50;

    if (card.description) {
        let lines = card.description.split("\n");

        gl.fillStyle = "#dddddd";
        gl.textAlign = "left";
        gl.font = "bold 18px Besley";
        for (let i = 0; i < lines.length; i++) {
            gl.fillText(lines[i].toUpperCase(), cornerWidth + 35, 70 + i * 27);
        }

        gl.save();
        gl.translate(w, h);
        gl.rotate(Math.PI);
        for (let i = 0; i < lines.length; i++) {
            gl.fillText(lines[i].toUpperCase(), cornerWidth + 35, 70 + i * 27);
        }

        gl.restore();
    }

    let rainbow = gl.createLinearGradient(0, 0, 0, h);
    rainbow.addColorStop(0, "#ff3333");
    rainbow.addColorStop(1 / 6, "#eeee00");
    rainbow.addColorStop(2 / 6, "#11ee11");
    rainbow.addColorStop(3 / 6, "#11eeee");
    rainbow.addColorStop(4 / 6, "#0055ff");
    rainbow.addColorStop(5 / 6, "#ff55ff");
    rainbow.addColorStop(6 / 6, "#ff3333");

    // Draw border
    gl.strokeStyle = borderColor === "rainbow" ? rainbow : borderColor;
    gl.fillStyle = borderColor === "rainbow" ? rainbow : borderColor;
    gl.lineWidth = 50;
    const AMOUNT = 50;
    const ROUNDING = 40;
    gl.beginPath();
    gl.moveTo(0, 0);
    gl.lineTo(w, 0);
    gl.lineTo(w - AMOUNT, 0);
    gl.arcTo(w, 0, w, AMOUNT, ROUNDING);
    gl.lineTo(w, h);
    gl.lineTo(w, h - AMOUNT);
    gl.arcTo(w, h, w - AMOUNT, h, ROUNDING);
    gl.lineTo(0, h);
    gl.lineTo(AMOUNT, h);
    gl.arcTo(0, h, 0, h - AMOUNT, ROUNDING);
    gl.lineTo(0, 0);
    gl.lineTo(0, AMOUNT);
    gl.arcTo(0, 0, AMOUNT, 0, ROUNDING);
    gl.stroke();

    // Draw border corners
    const CORNER_RADIUS = 5;
    const TOP_CORNER_W = cornerWidth,
        TOP_CORNER_H = 180;
    gl.beginPath();
    gl.moveTo(0, 0);
    gl.lineTo(TOP_CORNER_W, 0);
    gl.lineTo(TOP_CORNER_W, TOP_CORNER_H - CORNER_RADIUS);
    gl.arcTo(TOP_CORNER_W, TOP_CORNER_H, TOP_CORNER_W - CORNER_RADIUS, TOP_CORNER_H, 20);
    gl.lineTo(0, TOP_CORNER_H);
    gl.fill();
    const BOTTOM_CORNER_W = cornerWidth,
        BOTTOM_CORNER_H = 180;
    gl.beginPath();
    gl.moveTo(w, h);
    gl.lineTo(w - BOTTOM_CORNER_W, h);
    gl.lineTo(w - BOTTOM_CORNER_W, h - BOTTOM_CORNER_H + CORNER_RADIUS);
    gl.arcTo(w - BOTTOM_CORNER_W, h - BOTTOM_CORNER_H, w - BOTTOM_CORNER_W + CORNER_RADIUS, h - BOTTOM_CORNER_H, 20);
    gl.lineTo(w, h - BOTTOM_CORNER_H);
    gl.fill();

    // Draw corner value
    gl.textAlign = "center";
    gl.fillStyle = borderTextColor;
    gl.font = "120px Bangers";
    gl.fillText(card.value, cornerWidth / 2, 117);
    gl.save();
    gl.translate(w - cornerWidth / 2, h - 117);
    gl.rotate(Math.PI);
    gl.fillText(card.value, 0, 0);
    gl.restore();

    // Draw corner value description
    if (card.valueDescription) {
        gl.fillStyle = borderTextSmallColor;
        gl.font =
            card.value.length === 1 && card.valueDescription.length > 10
                ? "19px Bangers"
                : card.valueDescription.length > 7
                ? "24px Bangers"
                : card.valueDescription.length > 5
                ? "28px Bangers"
                : "32px Bangers";
        gl.fillText(card.valueDescription, cornerWidth / 2, 160);
        gl.save();
        gl.translate(w - cornerWidth / 2, h - 160);
        gl.rotate(Math.PI);
        gl.fillText(card.valueDescription, 0, 0);
        gl.restore();
    }
}

function CardForm(props: { card: Card; onChange: (card: Card) => void; database: idb.IDBPDatabase }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement>();
    const form = useForm(props.card);

    useEffect(() => {
        form.setValues(props.card);
    }, [props.card]);

    async function updateCanvas() {
        renderCanvas(canvasRef.current!, form.values, imageRef.current);
    }

    useEffect(() => {
        let imageId = form.listen("imageId", async () => {
            if (form.values.imageId) {
                if (!imageRef.current || form.values.imageId !== (imageRef.current as any).imageId) {
                    let dbImage = (await props.database.get("image", form.values.imageId)) as ImageFile;
                    if (dbImage) {
                        let img = await imageFileToImage(dbImage);
                        (img as any).imageId = form.values.imageId;
                        imageRef.current = img;
                        updateCanvas();
                    }
                }
            } else {
                imageRef.current = undefined;
            }
        });

        let id = form.listenAny(() => {
            setTimeout(() => updateCanvas(), 1);
        });
        return () => {
            form.ignore("imageId", imageId);
            form.ignoreAny(id);
        };
    }, []);

    return (
        <form
            className="flex flex-col"
            onSubmit={form.handleSubmit(() => {
                props.onChange({
                    ...form.values,
                    base64: canvasRef.current!.toDataURL(),
                });
            })}>
            <div className="grid gap-2" style={{ gridTemplateColumns: "200px 1fr" }}>
                <label htmlFor="">Amount</label>
                <Field type="number" form={form} name="amount" placeholder="1" />
                <label htmlFor="">Value</label>
                <Field form={form} name="value" placeholder="3" />
                <label htmlFor="">Value description</label>
                <Field form={form} name="valueDescription" placeholder="brie" />
                <label htmlFor="">Text</label>
                <Field as="textarea" form={form} name="text" />
                <label htmlFor="">Text font</label>
                <Field placeholder="45px Source Sans Pro" type="text" form={form} name="textFont" />
                <label htmlFor="">Text color</label>
                <div>
                    <Field type="color" form={form} name="textColor" />
                    <button type="button" onClick={() => form.setValue("textColor", undefined)}>
                        Reset
                    </button>
                </div>
                <label htmlFor="">Border color</label>
                <div>
                    <Field type="color" form={form} name="borderColor" />
                    <button type="button" onClick={() => form.setValue("borderColor", undefined)}>
                        Reset
                    </button>
                    <button type="button" onClick={() => form.setValue("borderColor", "rainbow")}>
                        Rainbow
                    </button>
                </div>
                <label htmlFor="">Border text color</label>
                <div>
                    <Field type="color" form={form} name="borderTextColor" />
                    <button type="button" onClick={() => form.setValue("borderTextColor", undefined)}>
                        Reset
                    </button>
                </div>
                <label htmlFor="">Border small text color</label>
                <div>
                    <Field type="color" form={form} name="borderSmallTextColor" />
                    <button type="button" onClick={() => form.setValue("borderSmallTextColor", undefined)}>
                        Reset
                    </button>
                </div>
                <label htmlFor="">Description</label>
                <Field as="textarea" form={form} name="description" />
                <label htmlFor="">No transition</label>
                <Field form={form} type="checkbox" name="noGradient" />
                <label htmlFor="">Image id</label>
                <Field form={form} name="imageId" />
                <label htmlFor="">
                    <a
                        className="text-blue-500 underline"
                        target="_blank"
                        href="https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter">
                        Image filter
                    </a>
                </label>
                <Field form={form} name="imageFilter" />
                <label htmlFor="">Image x</label>
                <Field min={-800} max={800} type="range" form={form} name="imageX" />
                <label htmlFor="">Image y</label>
                <Field min={-800} max={800} type="range" form={form} name="imageY" />
                <label htmlFor="">Image w</label>
                <Field min={200} max={1600} type="range" form={form} name="imageWidth" />
                <label htmlFor="">Image h</label>
                <Field min={200} max={2400} type="range" form={form} name="imageHeight" />

                <button type="submit" className="bg-blue-600 text-white">
                    Save
                </button>
            </div>
            <canvas ref={canvasRef} className="border border-black my-4" width="732px" height="1039px" />
        </form>
    );
}
