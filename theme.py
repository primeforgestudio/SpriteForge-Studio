"""Тёмно-серая тема в духе After Effects.

Модуль держит всю палитру приложения: цвета Qt-виджетов (`QSS`) и цвета
таймлайна/вьюпорта, которые рисуются вручную в `gui.py`.
"""

import os
import sys
import tempfile

from PySide6.QtCore import Qt
from PySide6.QtGui import QColor, QFont, QPainter, QPainterPath, QPalette, QPen, QPixmap

# Системный UI-шрифт своей платформы: Segoe UI на Windows, SF на macOS.
# В QSS перечисляем все варианты — Qt возьмёт первый существующий.
if sys.platform == "darwin":
    UI_FONT = "SF Pro Text"
    UI_FONT_SIZE = 10
elif sys.platform.startswith("linux"):
    UI_FONT = "Noto Sans"
    UI_FONT_SIZE = 9
else:
    UI_FONT = "Segoe UI"
    UI_FONT_SIZE = 9

FONT_STACK = '"Segoe UI", "SF Pro Text", "Helvetica Neue", "Noto Sans", sans-serif'

# --- базовая палитра -------------------------------------------------------
BG_WINDOW = "#383838"
BG_PANEL = "#2f2f2f"
BG_INPUT = "#252525"
BG_BUTTON = "#4a4a4a"
BG_BUTTON_HOVER = "#575757"
BG_BUTTON_PRESSED = "#3b3b3b"
BG_BUTTON_OFF = "#3a3a3a"
BORDER = "#1f1f1f"
BORDER_SOFT = "#4f4f4f"
TEXT = "#d6d6d6"
TEXT_DIM = "#9a9a9a"
TEXT_DISABLED = "#6b6b6b"
ACCENT = "#4f8cc9"
ACCENT_HOVER = "#6ba6de"
ACCENT_DARK = "#2f5f8f"

# --- вьюпорт ---------------------------------------------------------------
VIEWPORT_BG_ATLAS = "#1e1e1e"
VIEWPORT_BG_SPRITES = "#2a2a2a"
VIEWPORT_IMAGE_BG_SPRITES = "#666666"
DROPZONE_BORDER = "#5f5f5f"
DROPZONE_BORDER_ACTIVE = ACCENT_HOVER
DROPZONE_FILL_ACTIVE = "#2b3a49"
DROPZONE_TEXT = "#c2c2c2"
DROPZONE_HINT = "#8a8a8a"

# --- таймлайн --------------------------------------------------------------
TL_BG = "#333333"
TL_RULER_BG = "#2c2c2c"
TL_TRACK = "#242424"
TL_RANGE_TOP = "#4a5460"
TL_RANGE_BOTTOM = "#3a424c"
TL_OUT = "#1c1c1c"
TL_KEYLANE = "#2a2a2a"
TL_GRID = "#3f3f3f"
TL_TICK = "#606060"
TL_TEXT = "#a8a8a8"
TL_HANDLE = "#8fb8de"
TL_HANDLE_HOVER = "#cbe2f7"
TL_HANDLE_GRIP = "#1d2a36"
TL_KEY = "#c9d2da"
TL_KEY_HOVER = "#ffffff"
TL_KEY_SELECTED = "#f2b134"
TL_KEY_EDGE = "#161616"
TL_PLAYHEAD = "#e2574c"
TL_PLAYHEAD_TEXT = "#ffffff"

_QSS = """
* {
    outline: none;
}

QWidget {
    background-color: %(bg_window)s;
    color: %(text)s;
    font-family: %(font_stack)s;
    font-size: 12px;
}

QMainWindow, QDialog {
    background-color: %(bg_window)s;
}

QLabel {
    background: transparent;
    color: %(text)s;
}
QLabel:disabled {
    color: %(text_disabled)s;
}
QLabel#infoLabel {
    background-color: %(bg_input)s;
    border: 1px solid %(border)s;
    border-radius: 3px;
    color: %(text_dim)s;
    padding: 5px 9px;
}

QGroupBox {
    background-color: %(bg_panel)s;
    border: 1px solid %(border)s;
    border-radius: 4px;
    margin-top: 15px;
    padding: 9px 8px 8px 8px;
    font-weight: 600;
}
QGroupBox::title {
    subcontrol-origin: margin;
    subcontrol-position: top left;
    left: 9px;
    padding: 0 4px;
    color: %(text_dim)s;
}

QPushButton {
    background-color: %(bg_button)s;
    border: 1px solid %(border)s;
    border-radius: 3px;
    color: %(text)s;
    padding: 5px 12px;
    min-height: 17px;
}
QPushButton:hover {
    background-color: %(bg_button_hover)s;
}
QPushButton:pressed {
    background-color: %(bg_button_pressed)s;
}
QPushButton:checked {
    background-color: %(accent)s;
    border-color: %(accent_hover)s;
    color: #ffffff;
}
QPushButton:disabled {
    background-color: %(bg_button_off)s;
    border-color: #2b2b2b;
    color: %(text_disabled)s;
}
QPushButton#primaryButton {
    background-color: %(accent)s;
    border-color: %(accent_dark)s;
    color: #ffffff;
    font-weight: 600;
}
QPushButton#primaryButton:hover {
    background-color: %(accent_hover)s;
}
QPushButton#primaryButton:pressed {
    background-color: %(accent_dark)s;
}

QLineEdit, QSpinBox, QDoubleSpinBox, QComboBox {
    background-color: %(bg_input)s;
    border: 1px solid %(border)s;
    border-radius: 3px;
    color: %(text)s;
    padding: 3px 6px;
    min-height: 17px;
    selection-background-color: %(accent)s;
    selection-color: #ffffff;
}
QLineEdit:focus, QSpinBox:focus, QDoubleSpinBox:focus, QComboBox:focus {
    border-color: %(accent)s;
}
QLineEdit:disabled, QSpinBox:disabled, QDoubleSpinBox:disabled, QComboBox:disabled {
    background-color: #2b2b2b;
    color: %(text_disabled)s;
}
QSpinBox::up-button, QDoubleSpinBox::up-button,
QSpinBox::down-button, QDoubleSpinBox::down-button {
    background-color: #3d3d3d;
    border-left: 1px solid %(border)s;
    width: 15px;
}
QSpinBox::up-button:hover, QDoubleSpinBox::up-button:hover,
QSpinBox::down-button:hover, QDoubleSpinBox::down-button:hover {
    background-color: %(bg_button_hover)s;
}
QComboBox::drop-down {
    background-color: #3d3d3d;
    border-left: 1px solid %(border)s;
    width: 17px;
}
QComboBox QAbstractItemView {
    background-color: %(bg_panel)s;
    border: 1px solid %(border)s;
    selection-background-color: %(accent)s;
    selection-color: #ffffff;
}

QCheckBox {
    background: transparent;
    spacing: 6px;
}
QCheckBox:disabled {
    color: %(text_disabled)s;
}
QCheckBox::indicator {
    width: 14px;
    height: 14px;
    border: 1px solid %(border)s;
    border-radius: 3px;
    background-color: %(bg_input)s;
}
QCheckBox::indicator:hover {
    border-color: %(border_soft)s;
}
QCheckBox::indicator:checked {
    background-color: %(accent)s;
    border-color: %(accent_hover)s;
    %(check_image)s
}
QCheckBox::indicator:disabled {
    background-color: #2b2b2b;
    border-color: #2b2b2b;
}

QSlider::groove:horizontal {
    background-color: %(bg_input)s;
    border: 1px solid %(border)s;
    border-radius: 3px;
    height: 5px;
}
QSlider::sub-page:horizontal {
    background-color: %(accent)s;
    border: 1px solid %(accent_dark)s;
    border-radius: 3px;
    height: 5px;
}
QSlider::handle:horizontal {
    background-color: #c6c6c6;
    border: 1px solid #161616;
    border-radius: 2px;
    width: 9px;
    margin: -6px 0;
}
QSlider::handle:horizontal:hover {
    background-color: #eeeeee;
}
QSlider::handle:horizontal:disabled {
    background-color: #5a5a5a;
}

QTabWidget::pane {
    background-color: %(bg_panel)s;
    border: 1px solid %(border)s;
    border-radius: 3px;
    top: -1px;
}
QTabBar::tab {
    background-color: #333333;
    border: 1px solid %(border)s;
    border-bottom: none;
    border-top-left-radius: 3px;
    border-top-right-radius: 3px;
    color: %(text_dim)s;
    margin-right: 2px;
    padding: 6px 22px;
}
QTabBar::tab:hover:!selected {
    background-color: #3f3f3f;
    color: %(text)s;
}
QTabBar::tab:selected {
    background-color: %(bg_panel)s;
    border-top: 2px solid %(accent)s;
    color: #ffffff;
    font-weight: 600;
    padding-top: 5px;
}

QSplitter::handle {
    background-color: #262626;
}
QSplitter::handle:horizontal {
    width: 4px;
}
QSplitter::handle:hover {
    background-color: %(accent)s;
}

QScrollBar:vertical {
    background-color: %(bg_input)s;
    border: none;
    margin: 0;
    width: 12px;
}
QScrollBar::handle:vertical {
    background-color: #575757;
    border-radius: 4px;
    margin: 2px;
    min-height: 26px;
}
QScrollBar::handle:vertical:hover {
    background-color: #6d6d6d;
}
QScrollBar:horizontal {
    background-color: %(bg_input)s;
    border: none;
    height: 12px;
    margin: 0;
}
QScrollBar::handle:horizontal {
    background-color: #575757;
    border-radius: 4px;
    margin: 2px;
    min-width: 26px;
}
QScrollBar::handle:horizontal:hover {
    background-color: #6d6d6d;
}
QScrollBar::add-line, QScrollBar::sub-line {
    background: none;
    border: none;
    height: 0;
    width: 0;
}
QScrollBar::add-page, QScrollBar::sub-page {
    background: none;
}

QToolTip {
    background-color: #1b1b1b;
    border: 1px solid %(accent)s;
    color: %(text)s;
    padding: 4px 6px;
}
"""


def _icons_dir():
    folder = os.path.join(tempfile.gettempdir(), "SpriteForgeStudio_theme")
    os.makedirs(folder, exist_ok=True)
    return folder


def _make_check_icon():
    """Галочка для QCheckBox: стилизованный индикатор теряет нативный чекмарк."""
    try:
        path = os.path.join(_icons_dir(), "check.png")
        pixmap = QPixmap(14, 14)
        pixmap.fill(Qt.transparent)
        painter = QPainter(pixmap)
        painter.setRenderHint(QPainter.Antialiasing)
        pen = QPen(QColor("#ffffff"), 2.0)
        pen.setCapStyle(Qt.RoundCap)
        pen.setJoinStyle(Qt.RoundJoin)
        painter.setPen(pen)
        check = QPainterPath()
        check.moveTo(3.0, 7.5)
        check.lineTo(6.0, 10.5)
        check.lineTo(11.0, 3.5)
        painter.drawPath(check)
        painter.end()
        if pixmap.save(path, "PNG"):
            return path.replace("\\", "/")
    except Exception:
        pass
    return None


def _make_arrow_icon(direction):
    """Стрелки для QSpinBox/QComboBox: стилизованные sub-control теряют нативные."""
    try:
        path = os.path.join(_icons_dir(), "arrow_{}.png".format(direction))
        size = 9
        pixmap = QPixmap(size, size)
        pixmap.fill(Qt.transparent)
        painter = QPainter(pixmap)
        painter.setRenderHint(QPainter.Antialiasing)
        painter.setPen(Qt.NoPen)
        painter.setBrush(QColor(TEXT))
        arrow = QPainterPath()
        if direction == "up":
            arrow.moveTo(1.0, 6.5)
            arrow.lineTo(8.0, 6.5)
            arrow.lineTo(4.5, 2.5)
        else:
            arrow.moveTo(1.0, 2.5)
            arrow.lineTo(8.0, 2.5)
            arrow.lineTo(4.5, 6.5)
        arrow.closeSubpath()
        painter.drawPath(arrow)
        painter.end()
        if pixmap.save(path, "PNG"):
            return path.replace("\\", "/")
    except Exception:
        pass
    return None


def _arrow_rules():
    up = _make_arrow_icon("up")
    down = _make_arrow_icon("down")
    if not up or not down:
        return ""
    return """
QSpinBox::up-arrow, QDoubleSpinBox::up-arrow {{
    image: url("{up}");
    width: 9px;
    height: 9px;
}}
QSpinBox::down-arrow, QDoubleSpinBox::down-arrow, QComboBox::down-arrow {{
    image: url("{down}");
    width: 9px;
    height: 9px;
}}
QComboBox::down-arrow:on {{
    image: url("{up}");
}}
""".format(up=up, down=down)


def build_stylesheet():
    check_path = _make_check_icon()
    return _arrow_rules() + _QSS % {
        "bg_window": BG_WINDOW,
        "bg_panel": BG_PANEL,
        "bg_input": BG_INPUT,
        "bg_button": BG_BUTTON,
        "bg_button_hover": BG_BUTTON_HOVER,
        "bg_button_pressed": BG_BUTTON_PRESSED,
        "bg_button_off": BG_BUTTON_OFF,
        "border": BORDER,
        "border_soft": BORDER_SOFT,
        "text": TEXT,
        "text_dim": TEXT_DIM,
        "text_disabled": TEXT_DISABLED,
        "accent": ACCENT,
        "accent_hover": ACCENT_HOVER,
        "accent_dark": ACCENT_DARK,
        "font_stack": FONT_STACK,
        "check_image": 'image: url("{}");'.format(check_path) if check_path else "",
    }


def build_palette():
    palette = QPalette()
    palette.setColor(QPalette.Window, QColor(BG_WINDOW))
    palette.setColor(QPalette.WindowText, QColor(TEXT))
    palette.setColor(QPalette.Base, QColor(BG_INPUT))
    palette.setColor(QPalette.AlternateBase, QColor(BG_PANEL))
    palette.setColor(QPalette.ToolTipBase, QColor("#1b1b1b"))
    palette.setColor(QPalette.ToolTipText, QColor(TEXT))
    palette.setColor(QPalette.Text, QColor(TEXT))
    palette.setColor(QPalette.Button, QColor(BG_BUTTON))
    palette.setColor(QPalette.ButtonText, QColor(TEXT))
    palette.setColor(QPalette.BrightText, QColor("#ffffff"))
    palette.setColor(QPalette.Link, QColor(ACCENT_HOVER))
    palette.setColor(QPalette.Highlight, QColor(ACCENT))
    palette.setColor(QPalette.HighlightedText, QColor("#ffffff"))
    palette.setColor(QPalette.PlaceholderText, QColor(TEXT_DISABLED))
    for role in (QPalette.WindowText, QPalette.Text, QPalette.ButtonText):
        palette.setColor(QPalette.Disabled, role, QColor(TEXT_DISABLED))
    return palette


def apply_theme(app):
    """Ставит Fusion + тёмную палитру + QSS на всё приложение."""
    if app is None:
        return
    app.setStyle("Fusion")
    app.setPalette(build_palette())
    app.setFont(QFont(UI_FONT, UI_FONT_SIZE))
    app.setStyleSheet(build_stylesheet())
