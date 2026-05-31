import tkinter as tk

def test_clipboard():
    root = tk.Tk()
    root.title("Clipboard Test")

    def copy_text():
        text = text_widget.get("1.0", "end-1c")
        root.clipboard_clear()
        root.clipboard_append(text)
        try:
            root.clipboard_update()
            status_var.set("Copied with clipboard_update()")
        except:
            root.update()
            status_var.set("Copied with update()")

    text_widget = tk.Text(root, height=10, width=50)
    text_widget.pack(pady=10)
    text_widget.insert("1.0", "Test text to copy\nTry Ctrl+C or the button")

    btn = tk.Button(root, text="Copy All", command=copy_text)
    btn.pack(pady=5)

    status_var = tk.StringVar(value="Ready")
    status = tk.Label(root, textvariable=status_var)
    status.pack(pady=5)

    text_widget.bind("<Control-c>", lambda e: copy_text())

    root.mainloop()

if __name__ == "__main__":
    test_clipboard()
