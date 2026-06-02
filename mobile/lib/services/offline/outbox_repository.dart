import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

/// Estado de un item en la cola de salida (outbox).
enum OutboxStatus { pending, syncing, sent, error }

class OutboxItem {
  final int? id;
  final String clientUuid;
  final int vehicleId;
  final double latitude;
  final double longitude;
  final String? address;
  final String? description;
  OutboxStatus status;
  int retryCount;
  String? lastError;
  int? remoteId; // id real del incidente en el backend tras sincronizar
  final String createdAt;

  OutboxItem({
    this.id,
    required this.clientUuid,
    required this.vehicleId,
    required this.latitude,
    required this.longitude,
    this.address,
    this.description,
    this.status = OutboxStatus.pending,
    this.retryCount = 0,
    this.lastError,
    this.remoteId,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() => {
        'id': id,
        'client_uuid': clientUuid,
        'vehicle_id': vehicleId,
        'latitude': latitude,
        'longitude': longitude,
        'address': address,
        'description': description,
        'status': status.name,
        'retry_count': retryCount,
        'last_error': lastError,
        'remote_id': remoteId,
        'created_at': createdAt,
      };

  factory OutboxItem.fromMap(Map<String, dynamic> m) => OutboxItem(
        id: m['id'] as int?,
        clientUuid: m['client_uuid'] as String,
        vehicleId: m['vehicle_id'] as int,
        latitude: (m['latitude'] as num).toDouble(),
        longitude: (m['longitude'] as num).toDouble(),
        address: m['address'] as String?,
        description: m['description'] as String?,
        status: OutboxStatus.values.firstWhere(
          (s) => s.name == m['status'],
          orElse: () => OutboxStatus.pending,
        ),
        retryCount: (m['retry_count'] as int?) ?? 0,
        lastError: m['last_error'] as String?,
        remoteId: m['remote_id'] as int?,
        createdAt: m['created_at'] as String,
      );
}

/// Persiste la cola de emergencias creadas offline (patron outbox).
class OutboxRepository {
  OutboxRepository._();
  static final OutboxRepository instance = OutboxRepository._();

  Database? _db;

  Future<Database> get _database async {
    if (_db != null) return _db!;
    final dir = await getDatabasesPath();
    _db = await openDatabase(
      p.join(dir, 'rescateya_offline.db'),
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE outbox_incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_uuid TEXT UNIQUE NOT NULL,
            vehicle_id INTEGER NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            address TEXT,
            description TEXT,
            status TEXT NOT NULL,
            retry_count INTEGER NOT NULL DEFAULT 0,
            last_error TEXT,
            remote_id INTEGER,
            created_at TEXT NOT NULL
          )
        ''');
      },
    );
    return _db!;
  }

  Future<int> enqueue(OutboxItem item) async {
    final db = await _database;
    return db.insert('outbox_incidents', item.toMap(),
        conflictAlgorithm: ConflictAlgorithm.ignore);
  }

  Future<List<OutboxItem>> all() async {
    final db = await _database;
    final rows = await db.query('outbox_incidents', orderBy: 'created_at ASC');
    return rows.map(OutboxItem.fromMap).toList();
  }

  /// Items que aun deben enviarse (pendientes o con error previo).
  Future<List<OutboxItem>> pendingOrFailed() async {
    final db = await _database;
    final rows = await db.query(
      'outbox_incidents',
      where: 'status IN (?, ?)',
      whereArgs: [OutboxStatus.pending.name, OutboxStatus.error.name],
      orderBy: 'created_at ASC',
    );
    return rows.map(OutboxItem.fromMap).toList();
  }

  Future<int> countPending() async {
    final db = await _database;
    final rows = await db.rawQuery(
      'SELECT COUNT(*) c FROM outbox_incidents WHERE status != ?',
      [OutboxStatus.sent.name],
    );
    return Sqflite.firstIntValue(rows) ?? 0;
  }

  Future<void> update(OutboxItem item) async {
    final db = await _database;
    await db.update('outbox_incidents', item.toMap(),
        where: 'client_uuid = ?', whereArgs: [item.clientUuid]);
  }

  Future<void> markSent(String clientUuid, int remoteId) async {
    final db = await _database;
    await db.update(
      'outbox_incidents',
      {'status': OutboxStatus.sent.name, 'remote_id': remoteId, 'last_error': null},
      where: 'client_uuid = ?',
      whereArgs: [clientUuid],
    );
  }

  Future<void> markError(String clientUuid, String error, int retryCount) async {
    final db = await _database;
    await db.update(
      'outbox_incidents',
      {'status': OutboxStatus.error.name, 'last_error': error, 'retry_count': retryCount},
      where: 'client_uuid = ?',
      whereArgs: [clientUuid],
    );
  }
}
