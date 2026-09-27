unit form1;

interface


uses
  qtx.sysutils,
  qtx.classes,
  qtx.components,
  qtx.time,
  qtx.memory,
  qtx.delegates,
  qtx.dom.types,
  qtx.dom.events,
  qtx.dom.graphics,
  qtx.dom.palette,
  qtx.dom.widgets,
  qtx.dom.border,
  qtx.dom.theme,
  qtx.dom.application,
  qtx.dom.forms,
  qtx.dom.pixmap,
  qtx.dom.render,

  qtx.dom.control.dialog,

  qtx.dom.control.palette.picker,
  qtx.dom.render.colorwheel,
  qtx.dom.render.palette,
  qtx.dom.render.piechart,
  qtx.dom.events.mouse,
  qtx.dom.events.pointer,
  qtx.dom.events.keyboard,
  qtx.dom.events.touch,
  qtx.dom.control.label,
  qtx.dom.control.contentBox,
  qtx.dom.stylesheet,
  qtx.dom.graphic.view,
  qtx.dom.control.common,
  qtx.dom.control.palette,
  qtx.dom.control.Button,
  qtx.dom.control.edit,
  qtx.dom.control.checkbox,
  qtx.dom.control.label.content,
  qtx.dom.control.panel;



type

  TfrmMain = class( TQTXForm )
  {$I "intf::form1"}
  private
    fPalette:   TQTXPalette;
    fWheel:     TQTXColorWheelRenderer;
  protected
    procedure   StyleObject; override;

    procedure   HandlePaint(Sender: TObject; AContext: JDOMCanvasRenderingContext2D; ABounds: TRect);

  public
    constructor Create(AOwner: TQTXComponent; CB: TQTXFormConstructor); override;
    destructor  Destroy; override;
  end;

implementation

//#############################################################################
// TfrmMain
//#############################################################################

constructor TfrmMain.Create(AOwner: TQTXComponent; CB: TQTXFormConstructor);
begin
  inherited Create(AOwner, procedure (Form: TQTXForm)
  begin
    {$I "impl::form1"}

    fPalette := TQTXNetscapePalette.Create(self, nil);
    try
      fWheel := TQTXColorWheelRenderer.Create(400, 400);
      fWheel.Render();
    except
      on e: exception do
      begin
        Showmessage(e.Message);
        exit;
      end;
    end;

    Style.width := "100%";
    Style.height := "100%";

    GrView1.OnPaint := @HandlePaint;
    GrView1.Scaled := false;
    GrView1.Play( 1 );

    if assigned( CB ) then
     CB( self );
  end);
end;

destructor TfrmMain.destroy;
begin
  GrView1.Stop();
  fWheel.free;
  inherited;
end;

procedure  TfrmMain.StyleObject;
begin
  inherited;
end;

procedure TfrmMain.HandlePaint(Sender: TObject; AContext: JDOMCanvasRenderingContext2D; ABounds: TRect);
begin
  AContext.fillStyle := "blue";
  AContext.fillRect(0, 0, ABounds.right, ABounds.bottom);

  AContext.beginPath();
  AContext.strokeStyle := '#FFFFFF';
  AContext.moveTo(0,0);
  AContext.lineTo(ABounds.right,aBounds.Bottom);
  AContext.moveTo(0, ABounds.Bottom);
  AContext.lineTo(aBounds.right, 0);
  AContext.stroke();

  var dx := ( aBounds.Width div 2 ) - ( fWheel.Width div 2 );
  var dy := ( aBounds.Height div 2) - ( fWheel.Height div 2 );
  fWheel.DrawTo( AContext, dx, dy);

  AContext.font := '20px Verdana';
  AContext.fillStyle := "#FFFFFF";
  AContext.fillText( "FPS: " + GrView1.fps.ToString(), 10, 20);
end;

end.
